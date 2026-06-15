import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import type { MacroNutrients } from '@/lib/types'

const client = new Anthropic()

export interface CalorieBreakdownItem {
  item:      string
  kcal:      number
  protein_g: number
  fat_g:     number
  carb_g:    number
  fiber_g:   number
}

export interface CalorieEstimateResponse {
  breakdown:   CalorieBreakdownItem[]
  total:       number
  totalMacros: MacroNutrients
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured.' }, { status: 500 })
  }

  let meal: string, text: string
  try {
    ;({ meal, text } = await req.json() as { meal: string; text: string })
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!text?.trim()) {
    const empty: CalorieEstimateResponse = {
      breakdown: [],
      total: 0,
      totalMacros: { protein_g: 0, fat_g: 0, carb_g: 0, fiber_g: 0 },
    }
    return NextResponse.json(empty)
  }

  const prompt = `You are a nutrition expert estimating calories and macronutrients from food descriptions.

The user has entered the following foods for their ${meal}:
"${text}"

For each food item or ingredient mentioned:
- Use the quantity given. If no quantity is stated, assume one standard serving (use Indian portion sizes as the default).
- Estimate calories and macronutrients from standard nutrition references (ICMR/NIN or USDA).
- Round kcal to the nearest 5. Round each macronutrient to the nearest 0.5 g.

Return ONLY valid JSON in this exact shape — no markdown, no prose:
{
  "breakdown": [
    {
      "item": "1 cup curd",
      "kcal": 100,
      "protein_g": 8,
      "fat_g": 4,
      "carb_g": 7,
      "fiber_g": 0
    }
  ],
  "total": 100,
  "totalMacros": {
    "protein_g": 8,
    "fat_g": 4,
    "carb_g": 7,
    "fiber_g": 0
  }
}

Rules:
- "total" must equal the sum of all "kcal" values in "breakdown".
- Each field in "totalMacros" must equal the sum of that macro across all breakdown items.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw     = message.content.find(b => b.type === 'text')?.text ?? ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

    let parsed: CalorieEstimateResponse
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Model returned unparseable output.', raw }, { status: 502 })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
