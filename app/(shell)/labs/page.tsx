'use client'

import { useState } from 'react'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { BrandHeader } from '@/components/ui/BrandHeader'
import { RangeBar } from '@/components/dashboard/RangeBar'
import { TrendSparkline } from '@/components/dashboard/TrendSparkline'
import { HealthDial } from '@/components/dashboard/SystemCard'
import { mockData, bloodTrends } from '@/lib/data'
import type { BloodTestResult } from '@/lib/types'

// ── Constants ────────────────────────────────────────────────────────────────

type Status = 'normal' | 'borderline' | 'abnormal'

const STATUS_COLOR: Record<Status, string> = {
  normal:     '#5A7A50',
  borderline: '#B8842A',
  abnormal:   '#A63030',
}

const STATUS_LABEL: Record<Status, string> = {
  normal:     'All clear',
  borderline: 'Needs attention',
  abnormal:   'Out of range',
}

const NARRATIVES: Record<string, string> = {
  'Complete Blood Count':    'All blood cell counts are within range — no signs of anaemia or infection.',
  'Acute Phase Reactants':   'CRP is mildly elevated and ferritin is at the low end. Worth monitoring inflammation.',
  'Vitamins':                'Vitamin D is below the optimal zone. B12 and folate look healthy.',
  'Liver Function':          'Liver enzymes are all normal. The fatty liver index is marginally elevated.',
  'Kidney Function':         'All kidney markers are within range — filtration rate is excellent.',
  'Metabolic':               'Glucose and HbA1c are good. HOMA-IR is slightly elevated, an early signal of insulin resistance.',
  'Lipids & Cardiac':        'Cholesterol is well-managed. Non-HDL and TG/HDL ratio are mildly high.',
  'Thyroid':                 'TSH, FT3, and FT4 are all within normal range.',
  'Urinalysis':              'All urinalysis markers are normal.',
  'Hormones':                'Cortisol and DHEA-S are both within healthy ranges.',
  'Hormones · Optional':     'No optional hormone values recorded yet.',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function aggregateStatus(tests: Record<string, BloodTestResult>): Status {
  const statuses = Object.values(tests).map(t => t.status).filter(Boolean) as Status[]
  if (statuses.includes('abnormal'))   return 'abnormal'
  if (statuses.includes('borderline')) return 'borderline'
  return 'normal'
}

function healthScore(tests: Record<string, BloodTestResult>): number {
  const withStatus = Object.values(tests).filter(t => t.status && t.value)
  if (!withStatus.length) return 1
  const weighted = withStatus.reduce((sum, t) => {
    if (t.status === 'normal')     return sum + 1
    if (t.status === 'borderline') return sum + 0.5
    return sum
  }, 0)
  return weighted / withStatus.length
}

// ── Dot grid (overview card) ─────────────────────────────────────────────────

function DotGrid({ count, color }: { count: number; color: string }) {
  const dots = Math.min(count, 24)
  return (
    <div className="flex flex-wrap gap-[3.5px] mb-3" style={{ maxWidth: 76 }}>
      {Array.from({ length: dots }).map((_, i) => (
        <div key={i} className="w-[7px] h-[7px] rounded-full" style={{ background: color, opacity: 0.85 }} />
      ))}
    </div>
  )
}

// ── Overview card ────────────────────────────────────────────────────────────

function OverviewCard({ panel }: { panel: typeof mockData.bloodPanel }) {
  let optimal = 0, inRange = 0, outOfRange = 0
  for (const tests of Object.values(panel)) {
    for (const result of Object.values(tests)) {
      if (!result.value || result.status === undefined) continue
      if (result.status === 'normal')     optimal++
      else if (result.status === 'borderline') inRange++
      else if (result.status === 'abnormal')   outOfRange++
    }
  }

  const cols = [
    { label: 'Optimal',      count: optimal,    color: '#5A7A50' },
    { label: 'In range',     count: inRange,    color: '#B8842A' },
    { label: 'Out of range', count: outOfRange, color: '#A63030' },
  ]

  return (
    <div className="rounded-2xl p-5 mb-6" style={{ background: '#2C2A1E' }}>
      <p className="text-[11px] tracking-[.08em] uppercase mb-5" style={{ color: 'rgba(245,240,208,0.5)' }}>
        Blood biomarkers
      </p>
      <div className="grid grid-cols-3 gap-x-2">
        {/* Row 1: dot grids — tallest column sets the shared row height */}
        {cols.map(({ label, count, color }) => (
          <DotGrid key={`dots-${label}`} count={count} color={color} />
        ))}
        {/* Row 2: numbers — always on the same baseline */}
        {cols.map(({ label, count }) => (
          <p key={`num-${label}`} className="font-serif text-[34px] leading-none mb-1" style={{ color: '#F5F0D0' }}>
            {count}
          </p>
        ))}
        {/* Row 3: labels */}
        {cols.map(({ label }) => (
          <p key={`lbl-${label}`} className="text-[11px]" style={{ color: 'rgba(245,240,208,0.55)' }}>
            {label}
          </p>
        ))}
      </div>
    </div>
  )
}

// ── Parameter descriptions ───────────────────────────────────────────────────

const PARAM_DESC: Record<string, string> = {
  Haemoglobin:              'The protein in red blood cells that carries oxygen around your body. Low levels indicate anaemia; high levels can suggest dehydration or a blood disorder.',
  Haematocrit:              'The proportion of blood made up of red blood cells. Mirrors haemoglobin and helps confirm anaemia or polycythaemia.',
  MCV:                      'Mean corpuscular volume — the average size of your red blood cells. Abnormal values point to iron, B12, or folate issues.',
  MCH:                      'Mean corpuscular haemoglobin — average amount of haemoglobin per red cell. Elevated with B12/folate deficiency; low with iron deficiency.',
  MCHC:                     'Mean corpuscular haemoglobin concentration — haemoglobin density inside each red cell. Low values suggest iron deficiency anaemia.',
  RDW:                      'Red cell distribution width — variation in red cell size. Elevated values can signal mixed nutritional deficiencies or early anaemia.',
  'White Blood Cells':      "Your immune system's frontline cells. Elevated counts suggest infection or inflammation; low counts can indicate immune suppression.",
  Neutrophils:              'The most abundant white cell — your first responders to bacterial infection. Chronically low levels increase infection risk.',
  Lymphocytes:              'White cells involved in viral immunity and antibody production. Elevated in viral infections; low with immune deficiency.',
  Monocytes:                'Large immune cells that engulf pathogens and coordinate inflammatory responses. Mildly elevated counts often reflect chronic low-grade inflammation.',
  Eosinophils:              'White cells that respond to allergies and parasitic infections. Persistently elevated levels may point to asthma, hay fever, or food sensitivity.',
  Basophils:                'Rare white cells involved in allergic responses. Only clinically relevant when significantly elevated.',
  Platelets:                'Small cell fragments that form blood clots. Low counts increase bleeding risk; very high counts can raise clotting risk.',
  NLR:                      'Neutrophil-to-lymphocyte ratio — a sensitive inflammatory marker. Values above 3 are associated with increased cardiovascular and cancer risk.',
  'hs-CRP':                 'High-sensitivity C-reactive protein — the most widely used marker of systemic inflammation. Even mildly elevated levels are linked to higher cardiovascular risk.',
  ESR:                      'Erythrocyte sedimentation rate — a broad measure of inflammation. Less specific than CRP but useful for monitoring inflammatory conditions over time.',
  Ferritin:                 'The primary iron storage protein. Low ferritin depletes iron reserves before anaemia appears; elevated levels can signal inflammation or iron overload.',
  'Vitamin D (25-OH)':      'The storage form of vitamin D. Optimal levels support bone density, immune function, mood regulation, and reduced risk of several chronic diseases.',
  'Folate (B9)':            'Essential for DNA synthesis and red blood cell formation. Particularly important in pregnancy for neural tube development.',
  'Vitamin B12':            'Required for nerve function, DNA synthesis, and red blood cell production. Deficiency is common with plant-based diets or low stomach acid.',
  ALT:                      'Alanine aminotransferase — a liver enzyme that leaks into the bloodstream when liver cells are damaged. The most sensitive early marker of liver injury.',
  AST:                      'Aspartate aminotransferase — found in the liver, heart, and muscle. Elevated AST alongside ALT strongly suggests liver inflammation or damage.',
  GGT:                      'Gamma-glutamyl transferase — elevated by alcohol, fatty liver, and some medications. A sensitive but non-specific liver marker.',
  ALP:                      'Alkaline phosphatase — produced by the liver and bone. Elevated values suggest bile duct obstruction or bone turnover.',
  Bilirubin:                'A breakdown product of red blood cells processed by the liver. Elevated levels cause jaundice and suggest liver or bile duct problems.',
  'Total Protein':          'The sum of albumin and globulin in blood. Reflects nutritional status and liver synthetic function.',
  Albumin:                  'The main protein made by the liver. Low levels indicate malnutrition, liver disease, or chronic inflammation.',
  Globulin:                 'A group of proteins including immune antibodies. Elevated globulin can signal infection, autoimmune disease, or liver disease.',
  'Fatty Liver Index':      'A calculated score using BMI, waist circumference, GGT, and triglycerides. Scores above 30 suggest a higher likelihood of fatty liver disease.',
  Creatinine:               'A waste product from muscle metabolism cleared by the kidneys. Rising creatinine is an early warning sign of declining kidney function.',
  eGFR:                     'Estimated glomerular filtration rate — how much blood your kidneys filter per minute. The gold standard for tracking kidney function over time.',
  'BUN/Urea':               'Blood urea nitrogen — another kidney waste product. High values alongside elevated creatinine confirm impaired kidney function.',
  Sodium:                   'The main electrolyte controlling fluid balance. Abnormal levels affect nerve and muscle function and are often related to hydration.',
  Potassium:                'Critical for heart rhythm and muscle contraction. Even small deviations from normal can have significant cardiac effects.',
  Chloride:                 'Works alongside sodium to maintain fluid and acid-base balance. Usually follows sodium trends.',
  Calcium:                  'Needed for bone strength, nerve signalling, and muscle function. Abnormal levels require investigation of parathyroid gland function.',
  Bicarbonate:              "Reflects the body's acid-base balance. Low levels may indicate metabolic acidosis; high levels suggest alkalosis.",
  'Fasting Glucose':        'Blood sugar after an 8-hour fast — the standard screening test for diabetes and pre-diabetes. Optimal is below 90 mg/dL for long-term metabolic health.',
  'Fasting Insulin':        'The hormone that drives glucose into cells. Elevated fasting insulin often precedes high blood sugar and signals insulin resistance.',
  'HOMA-IR2':               'A calculated index of insulin resistance using fasting glucose and insulin. Values above 2.0 suggest the early stages of insulin resistance.',
  HbA1c:                    'Glycated haemoglobin — reflects average blood sugar over the past 3 months. A key diagnostic criterion for diabetes and a reliable cardiovascular risk marker.',
  'Total Cholesterol':      'The sum of all cholesterol in the blood. Context matters — high HDL can push this number up without raising cardiovascular risk.',
  HDL:                      'High-density lipoprotein — often called "good" cholesterol. It transports cholesterol to the liver for removal and protects against heart disease.',
  LDL:                      'Low-density lipoprotein — the primary driver of arterial plaque formation. Keeping LDL low (ideally under 100 mg/dL) significantly reduces cardiovascular risk.',
  Triglycerides:            'Fats circulating in the blood, largely driven by carbohydrate and alcohol intake. Elevated levels raise cardiovascular and pancreatitis risk.',
  'Non-HDL':                'Total cholesterol minus HDL — captures all atherogenic particles including LDL and VLDL. Often considered a better cardiovascular risk marker than LDL alone.',
  'TC/HDL Ratio':           'Total cholesterol to HDL ratio. A ratio below 4.0 is desirable; above 5.0 is associated with significantly increased cardiovascular risk.',
  'TG/HDL Ratio':           'Triglyceride to HDL ratio — a practical surrogate for insulin resistance and small dense LDL particle size. Values above 2.0 raise concern.',
  ApoB:                     'Apolipoprotein B — one protein per atherogenic lipoprotein particle. The most accurate single measure of cardiovascular risk from lipids.',
  'Lp(a)':                  'Lipoprotein(a) — an inherited cardiovascular risk factor. Unlike most lipids, it is not significantly changed by diet or exercise.',
  TSH:                      'Thyroid-stimulating hormone — produced by the pituitary to regulate the thyroid gland. The best single screening test for thyroid dysfunction.',
  FT3:                      'Free triiodothyronine — the most biologically active thyroid hormone. Low levels cause fatigue, weight gain, and cold sensitivity.',
  FT4:                      'Free thyroxine — the main hormone produced by the thyroid, which converts to FT3 in tissues. Used alongside TSH to diagnose hypothyroidism.',
  'Morning Cortisol':       'Your main stress hormone, naturally highest in the morning. Chronically elevated or low cortisol disrupts energy, sleep, immune function, and metabolism.',
  'DHEA-S':                 'A precursor hormone made by the adrenal glands that converts to testosterone and oestrogen. Declines with age and chronic stress.',
  'Colour & Transparency':  'A basic visual check of urine. Abnormal colour or cloudiness may indicate infection, dehydration, or blood.',
  Protein:                  'Protein should not appear in urine. Persistent proteinuria is an early marker of kidney damage.',
  Glucose:                  'Glucose in urine is abnormal and typically indicates diabetes or a low renal threshold for glucose.',
  Ketones:                  'Ketones appear in urine during fasting, low-carbohydrate diets, or diabetic ketoacidosis.',
  pH:                       'Urine acidity. Diet, kidney function, and infections all influence pH. Persistently alkaline urine may indicate a urinary tract infection.',
  RBC:                      'Red blood cells in urine (haematuria) can indicate kidney stones, infection, or more serious kidney or bladder disease.',
  'Pus Cells':              'White blood cells in urine — a primary indicator of urinary tract infection or kidney inflammation.',
  'Epithelial Cells':       'A small number is normal. Large amounts can indicate contamination or kidney tubular damage.',
  Casts:                    'Cylindrical structures formed in the kidney tubules. Their presence and type can reveal significant kidney pathology.',
  Crystals:                 'Crystals in urine are often benign but some types (e.g. uric acid, calcium oxalate) are associated with kidney stone formation.',
  Bacteria:                 'Bacteria in urine is abnormal and usually confirms a urinary tract infection when combined with elevated pus cells.',
  SHBG:                     'Sex hormone-binding globulin — a protein that binds testosterone and oestrogen, affecting how much is biologically active.',
  'Total Testosterone (men)': 'The total amount of testosterone in blood. Optimal levels support energy, muscle mass, libido, mood, and metabolic health.',
  'Free Testosterone (men)':  'The biologically active fraction of testosterone not bound to SHBG or albumin. A better indicator of functional testosterone status.',
  'Estradiol (women)':      'The primary oestrogen in reproductive-age women, important for bone health, cardiovascular protection, and mood regulation.',
  'FSH (women)':            'Follicle-stimulating hormone — elevated levels outside menopause suggest poor ovarian reserve; very low levels indicate pituitary issues.',
  'LH (women)':             'Luteinising hormone — triggers ovulation. Persistently elevated LH with high FSH suggests premature ovarian insufficiency.',
}

// ── Parameter row (expandable) ───────────────────────────────────────────────

function ParamRow({ name, result }: { name: string; result: BloodTestResult }) {
  const [open, setOpen] = useState(false)
  const trend    = bloodTrends[name]
  const dotColor = result.status ? STATUS_COLOR[result.status] : '#6B6650'
  const hasRange = !!result.value && !isNaN(parseFloat(result.value))
  const desc     = PARAM_DESC[name]

  const delta = trend && trend.points.length >= 2
    ? trend.points[trend.points.length - 1].value - trend.points[0].value
    : null

  return (
    <div className="border-b border-border last:border-0">
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 py-3 text-left cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-ink leading-tight">{name}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[13px] text-ink tabular-nums">
            {result.value || '—'}{result.unit ? ` ${result.unit}` : ''}
          </span>
          <div className="w-[7px] h-[7px] rounded-full" style={{ background: dotColor }} />
          {open
            ? <IconChevronUp size={13} strokeWidth={1.5} className="text-ink-2" />
            : <IconChevronDown size={13} strokeWidth={1.5} className="text-ink-2" />}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="pb-4 space-y-3">
          {/* Range bar */}
          {hasRange && (
            <div>
              <RangeBar result={result} />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-ink-2">ref {result.refRange}</span>
                {result.status && (
                  <span className="text-[10px] font-medium" style={{ color: dotColor }}>
                    {result.status === 'normal' ? 'Optimal' : result.status === 'borderline' ? 'Borderline' : 'Abnormal'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Trend sparkline + delta */}
          {trend && trend.points.length >= 2 && (
            <div className="flex items-center gap-3">
              <TrendSparkline data={trend.points} goodDirection={trend.goodDirection} showDelta />
              {delta !== null && (
                <span className="text-[10px] text-ink-2">
                  since {trend.points[0].date}
                </span>
              )}
            </div>
          )}

          {/* Description */}
          {desc && (
            <p className="text-[12px] text-ink-2 leading-relaxed">{desc}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── System accordion ─────────────────────────────────────────────────────────

function SystemAccordion({
  name,
  tests,
}: {
  name: string
  tests: Record<string, BloodTestResult>
}) {
  const [open, setOpen] = useState(false)

  const activeTests = Object.entries(tests).filter(([, r]) => r.value !== '')
  if (activeTests.length === 0) return null

  const activeMap = Object.fromEntries(activeTests)
  const status  = aggregateStatus(activeMap)
  const score   = healthScore(activeMap)
  const color   = STATUS_COLOR[status]

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card mb-3 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer"
      >
        <HealthDial pct={score} status={status} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-ink leading-snug">{name}</p>
          <p className="text-[12px] mt-0.5 font-medium" style={{ color }}>
            {STATUS_LABEL[status]}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-ink-2">{activeTests.length} markers</span>
          <IconChevronDown
            size={16}
            strokeWidth={1.5}
            className={`text-ink-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-5 pb-5 border-t border-border">
          {NARRATIVES[name] && (
            <p className="text-[12px] text-ink-2 leading-relaxed pt-3 pb-3 border-b border-border">
              {NARRATIVES[name]}
            </p>
          )}
          {activeTests.map(([testName, result]) => (
            <ParamRow key={testName} name={testName} result={result} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LabsPage() {
  const { bloodPanel } = mockData

  return (
    <>
      <BrandHeader />
      <div className="px-6 pt-5 pb-28">
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1.5">Blood panel</p>
        <h1 className="font-serif text-[28px] font-medium text-ink leading-snug mb-2">
          Your lab results
        </h1>
        <p className="text-[14px] text-ink-2 leading-relaxed mb-6">
          Overview of your labs with system statuses, range parameters and trend sparklines.
        </p>

        <OverviewCard panel={bloodPanel} />

        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-3">System breakdown</p>

        {Object.entries(bloodPanel).map(([name, tests]) => (
          <SystemAccordion key={name} name={name} tests={tests} />
        ))}
      </div>
    </>
  )
}
