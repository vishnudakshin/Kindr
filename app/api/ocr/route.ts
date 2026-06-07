import Anthropic from '@anthropic-ai/sdk'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import { NextRequest, NextResponse } from 'next/server'

// Exact group + test names that the form expects
const PANEL_GROUPS: Record<string, string[]> = {
  'Complete Blood Count': [
    'Haemoglobin', 'Haematocrit', 'MCV', 'MCH', 'MCHC', 'RDW',
    'White Blood Cells', 'Neutrophils', 'Lymphocytes', 'Monocytes',
    'Eosinophils', 'Basophils', 'Platelets', 'NLR',
  ],
  'Acute Phase Reactants': ['hs-CRP', 'ESR', 'Ferritin'],
  'Vitamins': ['Vitamin D (25-OH)', 'Folate (B9)', 'Vitamin B12'],
  'Liver Function': [
    'ALT', 'AST', 'GGT', 'ALP', 'Bilirubin', 'Total Protein',
    'Albumin', 'Globulin', 'Fatty Liver Index',
  ],
  'Kidney Function': [
    'Creatinine', 'eGFR', 'BUN/Urea', 'Sodium', 'Potassium',
    'Chloride', 'Calcium', 'Bicarbonate',
  ],
  'Metabolic': ['Fasting Glucose', 'Fasting Insulin', 'HOMA-IR2', 'HbA1c'],
  'Lipids & Cardiac': [
    'Total Cholesterol', 'HDL', 'LDL', 'Triglycerides', 'Non-HDL',
    'TC/HDL Ratio', 'TG/HDL Ratio', 'ApoB', 'Lp(a)',
  ],
  'Thyroid': ['TSH', 'FT3', 'FT4'],
  'Urinalysis': [
    'Colour & Transparency', 'Protein', 'Glucose', 'Ketones', 'pH',
    'RBC', 'Pus Cells', 'Epithelial Cells', 'Casts', 'Crystals', 'Bacteria',
  ],
  'Hormones': ['Morning Cortisol', 'DHEA-S'],
  'Hormones · Optional': [
    'SHBG', 'Total Testosterone (men)', 'Free Testosterone (men)',
    'Estradiol (women)', 'FSH (women)', 'LH (women)',
  ],
}

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type ImageMediaType = (typeof SUPPORTED_IMAGE_TYPES)[number]

const client = new Anthropic()

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server.' },
      { status: 500 },
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Could not parse form data.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })

  const isImage = (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(file.type)
  const isPdf = file.type === 'application/pdf'
  if (!isImage && !isPdf) {
    return NextResponse.json(
      { error: 'Unsupported file type. Upload a JPG, PNG, or PDF.' },
      { status: 400 },
    )
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  const fileBlock: ContentBlockParam = isPdf
    ? ({
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
      } as ContentBlockParam)
    : ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: file.type as ImageMediaType,
          data: base64,
        },
      } as ContentBlockParam)

  const prompt = `You are extracting blood test results from a lab report.

Return a JSON object where:
- Top-level keys are EXACTLY the group names listed below
- Each group's value is an object mapping test names to result values (strings, as shown in the report — just the result value, no units)
- Only include groups and tests you can clearly identify in the report
- Omit tests not present in the report

Groups and tests to extract:
${JSON.stringify(PANEL_GROUPS, null, 2)}

Return ONLY the JSON object. No markdown, no explanation.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [fileBlock, { type: 'text' as const, text: prompt }],
        },
      ],
    })

    const raw = message.content.find(b => b.type === 'text')?.text ?? ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

    let extracted: Record<string, Record<string, string>>
    try {
      extracted = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'Model returned unparseable output.', raw },
        { status: 502 },
      )
    }

    // Count non-empty values extracted
    let count = 0
    for (const tests of Object.values(extracted)) {
      for (const v of Object.values(tests)) {
        if (v !== '') count++
      }
    }

    return NextResponse.json({ extracted, count })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
