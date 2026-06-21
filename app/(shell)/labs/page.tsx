'use client'

import { useState } from 'react'
import { IconChevronDown, IconChevronUp, IconAlertCircle } from '@tabler/icons-react'
import { BrandHeader } from '@/components/ui/BrandHeader'
import { RangeBar } from '@/components/dashboard/RangeBar'
import { TrendSparkline } from '@/components/dashboard/TrendSparkline'
import { HealthDial } from '@/components/dashboard/SystemCard'
import { mockData, bloodTrends } from '@/lib/data'
import { interpretPanel, tierToStatus, type BiomarkerStatus, type SystemStatus as LabSysStatus } from '@/lib/lab-interpretation'
import { GROUP_TO_SYSTEM } from '@/lib/lab-config'
import type { BloodTestResult } from '@/lib/types'

// ── Constants ────────────────────────────────────────────────────────────────

type Status = 'normal' | 'borderline' | 'abnormal'

const STATUS_COLOR: Record<Status, string> = {
  normal:     '#5A7A50',
  borderline: '#B8842A',
  abnormal:   '#A63030',
}

const STATUS_LABEL: Record<Status, string> = {
  normal:     'Optimal',
  borderline: 'Needs attention',
  abnormal:   'Urgent',
}

const SYS_LABEL_COLOR: Record<string, string> = {
  'Optimal':        '#5A7A50',
  'Monitor':        '#B8842A',
  'Needs attention':'#A63030',
  'Urgent':         '#7D1A1A',
}

const NARRATIVES: Record<string, string> = {
  'Complete Blood Count':          'All blood cell counts are within range — no signs of anaemia or infection.',
  'Inflammation & Iron Profile':   'Ferritin tracks iron stores; ESR and CRP reflect systemic inflammation. Low ferritin is worth monitoring.',
  'Vitamins & Minerals':           'Vitamin D is below the optimal zone. B12 and folate look healthy. Electrolytes are within normal range.',
  'Liver Function':                'Liver enzymes are all normal. The fatty liver index is marginally elevated.',
  'Kidney Function':               'Creatinine and eGFR are excellent. Urea, uric acid, and BUN/creatinine ratio are all within range.',
  'Metabolic':                     'Glucose and HbA1c are good. HOMA-IR is slightly elevated, an early signal of insulin resistance.',
  'Lipids & Cardiac':              'Cholesterol is well-managed. Non-HDL and TG/HDL ratio are mildly high. hs-CRP is borderline — monitoring inflammation alongside lipids is useful.',
  'Thyroid':                       'TSH, FT3, and FT4 are all within normal range.',
  'Urinalysis':                    'All urinalysis markers are normal.',
  'Stress Hormones':               'Cortisol and DHEA-S are both within healthy ranges.',
  // These two are placeholder-only; shown only when no data is recorded (see accordion logic).
  'Hormones · Optional':           'No optional hormone values recorded yet.',
  'Allergy Panel - IgE':           'No allergy values recorded yet. Total IgE helps screen for overall allergic sensitisation.',
}

// Defines subheadings within certain accordion panels.
const SUBGROUPS: Record<string, { label: string; tests: string[] }[]> = {
  'Inflammation & Iron Profile': [
    { label: 'Inflammation', tests: ['ESR'] },
    { label: 'Iron Profile',  tests: ['Serum Iron', 'Ferritin', 'TIBC', 'Transferrin Saturation'] },
  ],
  'Vitamins & Minerals': [
    { label: 'Vitamins', tests: ['Vitamin D (25-OH)', 'Folate (B9)', 'Vitamin B12'] },
    { label: 'Minerals', tests: ['Sodium', 'Potassium', 'Chloride', 'Bicarbonate', 'Calcium', 'Magnesium'] },
  ],
  'Lipids & Cardiac': [
    { label: 'Lipids', tests: ['Total Cholesterol', 'HDL', 'LDL', 'Triglycerides', 'Non-HDL', 'TC/HDL Ratio', 'TG/HDL Ratio', 'ApoB', 'Lp(a)'] },
    { label: 'Cardiac inflammation', tests: ['hs-CRP'] },
  ],
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// Compute dial percentage from interpreted biomarker tiers (more accurate than raw status).
function computeDialPct(
  activeTests: [string, BloodTestResult][],
  bioMarkerMap: Map<string, BiomarkerStatus>,
): number {
  const scoreable = activeTests.filter(([n]) => {
    const b = bioMarkerMap.get(n)
    return b && b.tier !== 'unknown'
  })
  if (!scoreable.length) return healthScore(Object.fromEntries(activeTests))
  const score = scoreable.reduce((sum, [n]) => {
    const tier = bioMarkerMap.get(n)!.tier
    if (tier === 'optimal' || tier === 'normal') return sum + 1
    if (tier === 'watch') return sum + 0.5
    return sum
  }, 0)
  return score / scoreable.length
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

function OverviewCard({ biomarkers }: { biomarkers: BiomarkerStatus[] }) {
  let inRange = 0, watch = 0, outOfRange = 0
  for (const b of biomarkers) {
    if (b.tier === 'unknown') continue
    if (b.tier === 'optimal' || b.tier === 'normal') inRange++
    else if (b.tier === 'watch') watch++
    else outOfRange++ // out_of_range | critical
  }

  const cols = [
    { label: 'In range',     count: inRange,    color: '#5A7A50' },
    { label: 'Watch',        count: watch,      color: '#B8842A' },
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
  'Reticulocyte':           'Immature red blood cells released from bone marrow. A low count with anaemia points to impaired production (iron deficiency, B12, kidney disease); a high count suggests haemolysis or recovery from acute blood loss.',
  NLR:                      'Neutrophil-to-lymphocyte ratio — a sensitive inflammatory marker. Values above 3 are associated with increased cardiovascular and cancer risk.',
  'Absolute Neutrophil Count': 'The actual count of neutrophils in the blood — a more precise infection-risk marker than the percentage alone. Values below 1.0 indicate neutropenia; below 0.5 is severe and warrants urgent review.',
  'hs-CRP':                 'High-sensitivity C-reactive protein — the most widely used marker of systemic inflammation. Even mildly elevated levels are linked to higher cardiovascular risk.',
  ESR:                      'Erythrocyte sedimentation rate — a broad measure of inflammation. Less specific than CRP but useful for monitoring inflammatory conditions over time.',
  Ferritin:                 'The primary iron storage protein. Low ferritin depletes iron reserves before anaemia appears; elevated levels can signal inflammation or iron overload.',
  'Serum Iron':             'The amount of iron circulating in the blood. Low levels alongside high TIBC and low ferritin confirm iron deficiency.',
  TIBC:                     'Total iron-binding capacity — the amount of transferrin available to carry iron. High values indicate the body is hungry for more iron.',
  'Transferrin Saturation': 'The percentage of transferrin carrying iron (Serum Iron ÷ TIBC × 100). Below 20% suggests iron deficiency; above 50% suggests iron overload.',
  'Vitamin D (25-OH)':      'The storage form of vitamin D. Optimal levels support bone density, immune function, mood regulation, and reduced risk of several chronic diseases.',
  'Folate (B9)':            'Essential for DNA synthesis and red blood cell formation. Particularly important in pregnancy for neural tube development.',
  'Vitamin B12':            'Required for nerve function, DNA synthesis, and red blood cell production. Deficiency is common with plant-based diets or low stomach acid.',
  Magnesium:                'A mineral involved in over 300 enzyme reactions — including energy production, muscle function, and sleep. Serum levels underestimate total-body status.',
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
  Urea:                     'A waste product from protein metabolism, cleared by the kidneys. Elevated levels alongside a high creatinine point to declining kidney clearance; very low levels can reflect liver disease or low protein intake.',
  'Uric Acid':              'A breakdown product of purines (found in red meat, shellfish, alcohol, and fructose). Persistently high levels can cause gout and increase kidney stone risk.',
  'BUN/Creatinine Ratio':   'A ratio that helps distinguish why kidney markers are elevated. A high ratio (>20) usually points to dehydration or reduced blood flow to the kidneys; a low ratio (<10) may suggest liver disease or low protein intake.',
  Sodium:                   'The main electrolyte controlling fluid balance. Abnormal levels affect nerve and muscle function and are often related to hydration.',
  Potassium:                'Critical for heart rhythm and muscle contraction. Even small deviations from normal can have significant cardiac effects.',
  Chloride:                 'Works alongside sodium to maintain fluid and acid-base balance. Usually follows sodium trends.',
  Calcium:                  'Needed for bone strength, nerve signalling, and muscle function. Abnormal levels require investigation of parathyroid gland function.',
  Bicarbonate:              "Reflects the body's acid-base balance. Low levels may indicate metabolic acidosis; high levels suggest alkalosis.",
  'Fasting Glucose':        'Blood sugar after an 8-hour fast — the standard screening test for diabetes and pre-diabetes. Optimal is below 90 mg/dL for long-term metabolic health.',
  'Fasting Insulin':        'The hormone that drives glucose into cells. Elevated fasting insulin often precedes high blood sugar and signals insulin resistance.',
  'HOMA-IR':                'A calculated index of insulin resistance using fasting glucose and insulin. Values above 2.0 suggest the early stages of insulin resistance.',
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
  Casts:                    'Cylindrical structures formed in the kidney tubules. Their presence and type can reveal significant kidney pathology.',
  Crystals:                 'Crystals in urine are often benign but some types (e.g. uric acid, calcium oxalate) are associated with kidney stone formation.',
  'Total IgE':              'The total level of IgE antibodies — the immune proteins involved in allergic responses. Elevated levels suggest generalised allergic sensitisation, though a normal result does not rule out specific allergies.',
  SHBG:                     'Sex hormone-binding globulin — a protein that binds testosterone and oestrogen, affecting how much is biologically active.',
  'Total Testosterone (men)': 'The total amount of testosterone in blood. Optimal levels support energy, muscle mass, libido, mood, and metabolic health.',
  'Free Testosterone (men)':  'The biologically active fraction of testosterone not bound to SHBG or albumin. A better indicator of functional testosterone status.',
  'Estradiol (women)':      'The primary oestrogen in reproductive-age women, important for bone health, cardiovascular protection, and mood regulation.',
  'FSH (women)':            'Follicle-stimulating hormone — elevated levels outside menopause suggest poor ovarian reserve; very low levels indicate pituitary issues.',
  'LH (women)':             'Luteinising hormone — triggers ovulation. Persistently elevated LH with high FSH suggests premature ovarian insufficiency.',
}

// ── Parameter row (expandable) ───────────────────────────────────────────────

function ParamRow({
  name, result, bioStat, hasTrend,
}: {
  name: string
  result: BloodTestResult
  bioStat?: BiomarkerStatus
  hasTrend?: boolean
}) {
  const [open, setOpen] = useState(false)
  const trend = hasTrend ? bloodTrends[name] : undefined

  // Interpretation tier overrides raw status when available.
  const effectiveStatus: Status = bioStat
    ? tierToStatus(bioStat.tier)
    : (result.status ?? 'normal')
  const dotColor = STATUS_COLOR[effectiveStatus]
  const hasRange = !!result.value && !isNaN(parseFloat(result.value))
  const desc = PARAM_DESC[name]

  // Effective result for RangeBar — override status with interpreted value.
  const displayResult: BloodTestResult = bioStat
    ? { ...result, status: effectiveStatus }
    : result

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
          <span className="text-[13px] tabular-nums font-medium" style={{ color: dotColor }}>
            {result.value || '—'}
          </span>
          {result.unit && (
            <span className="text-[11px]" style={{ color: dotColor, opacity: 0.8 }}>
              {result.unit}
            </span>
          )}
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
            <RangeBar result={displayResult} bioStat={bioStat} />
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

          {/* Clinical note from biomarker definition */}
          {bioStat?.note && (
            <p className="text-[11px] text-ink-2 italic leading-relaxed border-l-2 border-accent pl-2">
              {bioStat.note}
            </p>
          )}

          {/* Refer flag */}
          {bioStat?.refer && (
            <div className="flex items-start gap-1.5 rounded-lg px-3 py-2" style={{ background: '#FEF2F2' }}>
              <IconAlertCircle size={13} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: '#A63030' }} />
              <p className="text-[11px] leading-relaxed" style={{ color: '#A63030' }}>
                This result warrants clinical follow-up — please discuss with your doctor.
              </p>
            </div>
          )}

          {/* Inflammation confounder flag (ferritin) */}
          {bioStat?.flags.includes('iron_status_uncertain_inflammation') && (
            <p className="text-[11px] text-ink-2 italic leading-relaxed border-l-2 border-accent pl-2">
              hs-CRP is elevated — ferritin may appear normal while masking iron deficiency.
            </p>
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
  sysStat,
  bioMarkerMap,
  hasTrend,
}: {
  name: string
  tests: Record<string, BloodTestResult>
  sysStat?: LabSysStatus
  bioMarkerMap: Map<string, BiomarkerStatus>
  hasTrend?: boolean
}) {
  const [open, setOpen] = useState(false)

  const activeTests = Object.entries(tests).filter(([, r]) => r.value !== '')
  const hasData = activeTests.length > 0

  // Show panels with no recorded values only when they have a narrative placeholder
  // (e.g. Allergy Panel, Hormones · Optional) — hide otherwise.
  if (!hasData && !NARRATIVES[name]) return null

  const activeMap = Object.fromEntries(activeTests)

  // Allergy Panel with no data shows amber "Needs attention" — not red — since
  // absence of allergy testing is not an emergency.
  const isAllergyEmpty = name === 'Allergy Panel - IgE' && !hasData
  const dialPct = isAllergyEmpty ? 0.3
    : !hasData ? 0
    : computeDialPct(activeTests, bioMarkerMap)
  // Threshold: 100% → Optimal (green), 40–99% → Needs attention (amber), <40% → Urgent (red)
  const dialStatus: Status = isAllergyEmpty ? 'borderline'
    : !hasData ? 'normal'
    : dialPct >= 1.0 ? 'normal'
    : dialPct >= 0.4 ? 'borderline'
    : 'abnormal'
  const displayLabel = isAllergyEmpty ? STATUS_LABEL['borderline']
    : !hasData ? 'No results recorded'
    : STATUS_LABEL[dialStatus]
  const displayColor = isAllergyEmpty ? STATUS_COLOR['borderline']
    : !hasData ? '#6B6650'
    : STATUS_COLOR[dialStatus]

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card mb-3 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer"
      >
        <HealthDial pct={dialPct} status={dialStatus} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-ink leading-snug">{name}</p>
          <p className="text-[12px] mt-0.5 font-medium" style={{ color: displayColor }}>
            {displayLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-ink-2">
            {hasData ? `${activeTests.length} markers` : `${Object.keys(tests).length} test${Object.keys(tests).length !== 1 ? 's' : ''}`}
          </span>
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
          {/* Placeholder-only narratives (Hormones Optional, Allergy) are hidden when data exists */}
          {NARRATIVES[name] && (hasData ? name !== 'Hormones · Optional' && name !== 'Allergy Panel - IgE' : true) && (
            <p className="text-[12px] text-ink-2 leading-relaxed pt-3 pb-3 border-b border-border">
              {NARRATIVES[name]}
            </p>
          )}
          {sysStat?.refer && (
            <div className="flex items-start gap-1.5 rounded-lg px-3 py-2 mt-3 mb-1" style={{ background: '#FEF2F2' }}>
              <IconAlertCircle size={13} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: '#A63030' }} />
              <p className="text-[11px] leading-relaxed" style={{ color: '#A63030' }}>
                One or more markers in this panel warrant clinical review.
              </p>
            </div>
          )}
          {SUBGROUPS[name]
            ? SUBGROUPS[name].map(sg => {
                // Show tests that have values OR that are in the panel but not yet entered (shows '—').
                // This ensures expected markers like ESR always appear in their subgroup heading.
                const sgTests = sg.tests
                  .map(t => {
                    const withValue = activeTests.find(([n]) => n === t)
                    if (withValue) return withValue
                    const stub = tests[t]
                    return stub !== undefined ? ([t, stub] as [string, BloodTestResult]) : null
                  })
                  .filter((x): x is [string, BloodTestResult] => x !== null)
                if (sgTests.length === 0) return null
                return (
                  <div key={sg.label}>
                    <p className="text-[10px] tracking-[.07em] uppercase text-ink-2 pt-3 pb-1.5 border-b border-border mb-0.5">
                      {sg.label}
                    </p>
                    {sgTests.map(([testName, result]) => (
                      <ParamRow
                        key={testName}
                        name={testName}
                        result={result}
                        bioStat={bioMarkerMap.get(testName)}
                        hasTrend={hasTrend}
                      />
                    ))}
                  </div>
                )
              })
            : activeTests.map(([testName, result]) => (
                <ParamRow
                  key={testName}
                  name={testName}
                  result={result}
                  bioStat={bioMarkerMap.get(testName)}
                  hasTrend={hasTrend}
                />
              ))
          }
        </div>
      )}
    </div>
  )
}

// ── Derived / computed indices ────────────────────────────────────────────────

// Derived indices in display order
const DERIVED_ORDER = [
  'TyG Index', 'HOMA-IR', 'Remnant Cholesterol',
  'A/G Ratio', 'Corrected Calcium', 'LH/FSH Ratio',
]

function fmtRef(b: BiomarkerStatus): string {
  const r = b.refRange
  if (!r) return ''
  if (r.low !== undefined && r.high !== undefined) return `${r.low}–${r.high}`
  if (r.high !== undefined) return `<${r.high}`
  if (r.low !== undefined) return `>${r.low}`
  return ''
}

function DerivedRow({ b }: { b: BiomarkerStatus }) {
  const [open, setOpen] = useState(false)
  const val = b.value !== null ? String(b.value) : ''
  const status = tierToStatus(b.tier)
  const dotColor =
    b.tier === 'critical' || b.tier === 'out_of_range' ? '#A63030'
    : b.tier === 'watch' ? '#B8842A'
    : b.tier === 'optimal' || b.tier === 'normal' ? '#5A7A50'
    : '#9A9478'

  const syntheticResult: BloodTestResult = {
    value: val,
    unit: b.unit,
    refRange: fmtRef(b),
    status,
  }

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 py-3 text-left cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-ink leading-tight">{b.name}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[13px] tabular-nums font-medium" style={{ color: dotColor }}>
            {val || '—'}
          </span>
          {b.unit && (
            <span className="text-[11px]" style={{ color: dotColor, opacity: 0.8 }}>{b.unit}</span>
          )}
          {open
            ? <IconChevronUp size={13} strokeWidth={1.5} className="text-ink-2" />
            : <IconChevronDown size={13} strokeWidth={1.5} className="text-ink-2" />}
        </div>
      </button>
      {open && (
        <div className="pb-4 space-y-3">
          <RangeBar result={syntheticResult} bioStat={b} />
          {b.note && (
            <p className="text-[11px] text-ink-2 italic leading-relaxed border-l-2 border-accent pl-2">
              {b.note}
            </p>
          )}
          {b.refer && (
            <div className="flex items-start gap-1.5 rounded-lg px-3 py-2" style={{ background: '#FEF2F2' }}>
              <IconAlertCircle size={13} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: '#A63030' }} />
              <p className="text-[11px] leading-relaxed" style={{ color: '#A63030' }}>
                This result warrants clinical follow-up.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DerivedIndicesSection({
  bioMarkerMap,
  rawPanel,
}: {
  bioMarkerMap: Map<string, BiomarkerStatus>
  rawPanel: Record<string, Record<string, BloodTestResult>>
}) {
  const [open, setOpen] = useState(false)

  // Collect derived biomarkers not already present in the raw panel (as primary entries).
  const rawNames = new Set(Object.values(rawPanel).flatMap(g => Object.keys(g)))

  const derived = DERIVED_ORDER
    .map(name => bioMarkerMap.get(name))
    .filter((b): b is BiomarkerStatus =>
      !!b && b.flags.includes('derived') && b.value !== null && !rawNames.has(b.name)
    )

  if (derived.length === 0) return null

  const TIER_RANK: Record<string, number> = { critical: 5, out_of_range: 4, watch: 3, normal: 2, optimal: 1, unknown: 0 }
  const worstTier = derived.reduce(
    (acc, b) => (TIER_RANK[b.tier] ?? 0) > (TIER_RANK[acc] ?? 0) ? b.tier : acc,
    'unknown' as string,
  )
  const dialStatus: 'normal' | 'borderline' | 'abnormal' =
    worstTier === 'critical' || worstTier === 'out_of_range' ? 'abnormal'
    : worstTier === 'watch' ? 'borderline'
    : 'normal'

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card mb-3 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer"
      >
        <HealthDial pct={dialStatus === 'normal' ? 1 : dialStatus === 'borderline' ? 0.6 : 0.3} status={dialStatus} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-ink leading-snug">Computed Indices</p>
          <p className="text-[12px] mt-0.5 font-medium text-ink-2">
            Derived from your panel values
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-ink-2">{derived.length} indices</span>
          <IconChevronDown
            size={16} strokeWidth={1.5}
            className={`text-ink-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-border">
          <p className="text-[12px] text-ink-2 leading-relaxed pt-3 pb-3 border-b border-border">
            These values are calculated automatically from your blood results — TyG Index (insulin resistance), Remnant Cholesterol, A/G Ratio, and Corrected Calcium.
          </p>
          {derived.map(b => <DerivedRow key={b.name} b={b} />)}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LabsPage() {
  const { bloodPanel, questionnaire, scoreHistory } = mockData
  const labInterp = interpretPanel(bloodPanel, questionnaire.history)

  const bioMarkerMap = new Map<string, BiomarkerStatus>(
    labInterp.biomarkers.map(b => [b.name, b])
  )
  const sysMap = new Map<string, LabSysStatus>(
    labInterp.systems.map(s => [s.system, s])
  )

  // Only count markers from the actual panel (not computed-only derived indices like FIB-4, TyG, etc.)
  const rawPanelNames = new Set(Object.values(bloodPanel).flatMap(g => Object.keys(g)))
  const primaryBiomarkers = labInterp.biomarkers.filter(b => rawPanelNames.has(b.name))

  // Only show trend sparklines for users with prior test history (not on their first test).
  const hasTrendHistory = scoreHistory.length > 1

  return (
    <>
      <BrandHeader href="/" />
      <div className="px-6 pt-5 pb-28">
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1.5">Blood panel</p>
        <h1 className="font-serif text-[28px] font-medium text-ink leading-snug mb-2">
          Your lab results
        </h1>
        <p className="text-[14px] text-ink-2 leading-relaxed mb-6">
          Overview of your labs with system statuses, range parameters and trend sparklines.
        </p>

        <OverviewCard biomarkers={primaryBiomarkers} />

        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-3">System breakdown</p>

        {Object.entries(bloodPanel).map(([name, tests]) => {
          const systemKey = GROUP_TO_SYSTEM[name]
          const sysStat   = systemKey ? sysMap.get(systemKey) : undefined
          return (
            <SystemAccordion
              key={name}
              name={name}
              tests={tests}
              sysStat={sysStat}
              bioMarkerMap={bioMarkerMap}
              hasTrend={hasTrendHistory}
            />
          )
        })}

        {/* Derived / computed indices */}
        <DerivedIndicesSection bioMarkerMap={bioMarkerMap} rawPanel={bloodPanel} />

        {/* Resubmit */}
        <div className="mt-6 pt-6 border-t border-border">
          <a
            href="/labs/entry"
            className="flex items-center justify-center w-full rounded-full bg-ink text-[#F5F0D0] font-medium text-[13px] py-3.5 hover:opacity-90 transition-opacity"
          >
            Update lab panel
          </a>
          <p className="text-[11px] text-ink-2 text-center mt-2 leading-relaxed">
            New results? Resubmit your blood panel to refresh your scores.
          </p>
        </div>
      </div>
    </>
  )
}
