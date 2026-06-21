// lib/lab-config.ts
//
// Biomarker registry for Layer 2 (lab interpretation). Keyed by the EXACT test names emitted by the
// OCR PANEL_GROUPS so extracted values flow straight in. Each entry defines the unit it expects, the
// body-system it rolls up into, a direction, a clinical reference range (sex/age-aware where needed),
// an optional 'optimal' band, optional critical (red-flag) bounds, and Layer-1 cross-link tags.
//
// IMPORTANT CAVEATS
//  • Ranges below are standard ADULT conventional-unit ranges (the units common in Indian labs).
//    They MUST be reviewed by a clinician and ideally overridden per-lab — reference intervals vary by
//    assay. Each entry's `unit` is the unit the value is assumed to be in; OCR output must be in that
//    unit or normalised first, or the status will be wrong.
//  • `ref` = population clinical range (the basis for out-of-range FLAGS). `optimal` = a narrower,
//    preference-based "functional" band — surface it as guidance, never as a diagnosis.
//  • This is wellness/education, not diagnosis. `critical` bounds and qualitative abnormals set a
//    `refer` flag that should route the user to a clinician rather than a self-care tip.

import type { Ethnicity } from './types'

export type Sex = 'male' | 'female' | 'unknown'

export type BodySystem =
  | 'Thyroid' | 'Liver' | 'Kidney' | 'Heart'
  | 'Vitamins' | 'Blood & immune' | 'Metabolic' | 'Hormones'

export type Direction =
  | 'high_bad'    // higher = worse (hs-CRP, glucose, LDL…)
  | 'low_bad'     // lower = worse (vitamin D, HDL, eGFR, haemoglobin…)
  | 'two_sided'   // out of range either way (TSH, electrolytes…)
  | 'qualitative' // categorical urinalysis values
  | 'context'     // interpret only with other markers / cycle / menopausal status

export interface NumericRange { low?: number; high?: number }
export type RangeBySex = { male: NumericRange; female: NumericRange; unknown?: NumericRange }
export interface PatientContext {
  age: number | null
  sex: Sex
  ethnicity: Ethnicity
  menopausal?: boolean
  hsCRPElevated?: boolean // set during interpretPanel; used for the ferritin confounder rule
}
export type RangeSpec = NumericRange | RangeBySex | ((ctx: PatientContext) => NumericRange)

export interface BiomarkerDef {
  unit: string
  system: BodySystem
  direction: Direction
  ref?: RangeSpec
  optimal?: RangeSpec
  critical?: RangeSpec
  normalValues?: string[]   // qualitative: substrings treated as normal
  abnormalValues?: string[] // qualitative: substrings treated as abnormal
  referOnAbnormal?: boolean  // qualitative/critical → route to clinician
  crossLinks?: string[]      // Layer-1 domain names + symptom keyword fragments
  note?: string
}

// Fallback system for any extracted marker not in the registry, by its OCR group.
export const GROUP_TO_SYSTEM: Record<string, BodySystem> = {
  'Complete Blood Count': 'Blood & immune',
  'Inflammation & Iron Profile': 'Blood & immune',
  'Vitamins & Minerals': 'Vitamins',
  'Liver Function': 'Liver',
  'Kidney Function': 'Kidney',
  'Urinalysis': 'Kidney',
  'Metabolic': 'Metabolic',
  'Lipids & Cardiac': 'Heart',
  'Thyroid': 'Thyroid',
  'Hormones': 'Hormones',
  'Allergy Panel - IgE': 'Blood & immune',
}

// OCR schema — matches the current panel. Import into app/api/ocr/route.ts so the extraction schema
// and registry stay in lock-step. Derived indices (FIB-4, TyG, etc.) are NOT here — they are computed.
export const PANEL_GROUPS: Record<string, string[]> = {
  'Complete Blood Count': [
    'Haemoglobin', 'Haematocrit', 'MCV', 'MCH', 'MCHC', 'RDW',
    'White Blood Cells', 'Absolute Neutrophil Count', 'Neutrophils', 'Lymphocytes',
    'Monocytes', 'Eosinophils', 'Basophils', 'Platelets', 'Reticulocyte', 'NLR',
  ],
  'Inflammation & Iron Profile': ['ESR', 'Ferritin', 'Serum Iron', 'TIBC', 'Transferrin Saturation'],
  'Vitamins & Minerals': [
    'Vitamin D (25-OH)', 'Folate (B9)', 'Vitamin B12', 'Magnesium',
    'Sodium', 'Potassium', 'Chloride', 'Bicarbonate', 'Calcium',
  ],
  'Liver Function': [
    'ALT', 'AST', 'GGT', 'ALP', 'Bilirubin', 'Total Protein',
    'Albumin', 'Globulin', 'Fatty Liver Index',
  ],
  'Kidney Function': ['Creatinine', 'eGFR', 'Urea', 'Uric Acid', 'BUN/Creatinine Ratio'],
  'Metabolic': ['Fasting Glucose', 'Fasting Insulin', 'HOMA-IR', 'HbA1c'],
  'Lipids & Cardiac': [
    'Total Cholesterol', 'HDL', 'LDL', 'Triglycerides', 'Non-HDL',
    'TC/HDL Ratio', 'TG/HDL Ratio', 'ApoB', 'Lp(a)', 'hs-CRP',
  ],
  'Thyroid': ['TSH', 'FT3', 'FT4', 'Total T3', 'Total T4'],
  'Urinalysis': [
    'Colour & Transparency', 'Protein', 'Glucose', 'Ketones', 'pH',
    'RBC', 'Pus Cells', 'Casts', 'Crystals',
  ],
  'Hormones': [
    'Morning Cortisol', 'DHEA-S',
    'SHBG', 'Total Testosterone', 'Free Testosterone (men)',
    'Estradiol (women)', 'FSH (women)', 'LH (women)',
  ],
  'Allergy Panel - IgE': ['Total IgE'],
}

// age-dependent helpers
const esrUpper = (ctx: PatientContext): NumericRange => {
  // Westergren rule of thumb: upper ≈ age/2 (men), (age+10)/2 (women).
  const a = ctx.age ?? 50
  return { high: ctx.sex === 'female' ? (a + 10) / 2 : a / 2 }
}

export const BIOMARKERS: Record<string, BiomarkerDef> = {
  // ── Complete Blood Count → Blood & immune ──────────────────────────────
  'Haemoglobin': {
    unit: 'g/dL', system: 'Blood & immune', direction: 'low_bad',
    ref: { male: { low: 13.0, high: 17.0 }, female: { low: 12.0, high: 15.5 } },
    critical: { low: 8 }, crossLinks: ['fatigue', 'activity', 'cognition'],
  },
  'Haematocrit': {
    unit: '%', system: 'Blood & immune', direction: 'low_bad',
    ref: { male: { low: 40, high: 50 }, female: { low: 36, high: 46 } }, crossLinks: ['fatigue'],
  },
  'MCV': { unit: 'fL', system: 'Blood & immune', direction: 'two_sided', ref: { low: 83, high: 101 },
    note: 'Low → consider iron deficiency; high → consider B12/folate deficiency.' },
  'MCH': { unit: 'pg', system: 'Blood & immune', direction: 'two_sided', ref: { low: 27, high: 32 } },
  'MCHC': { unit: 'g/dL', system: 'Blood & immune', direction: 'two_sided', ref: { low: 31.5, high: 34.5 } },
  'RDW': { unit: '%', system: 'Blood & immune', direction: 'high_bad', ref: { high: 14.0 },
    note: 'Elevated RDW can be an early sign of mixed nutritional deficiency.' },
  // Indian labs report WBC and absolute counts in cells/µL (= cells/cumm); enter values as-is from the report.
  'White Blood Cells': { unit: 'cells/µL', system: 'Blood & immune', direction: 'two_sided',
    ref: { low: 4000, high: 11000 }, critical: { low: 2000, high: 30000 }, crossLinks: ['illness'] },
  // Neutrophils and other differential counts are reported as % of WBC on Indian lab reports.
  'Neutrophils': { unit: '%', system: 'Blood & immune', direction: 'two_sided',
    ref: { low: 40, high: 80 },
    note: 'Differential percentage. Low → consider viral infection or bone-marrow suppression; high → bacterial infection or stress.' },
  'Lymphocytes': { unit: '%', system: 'Blood & immune', direction: 'two_sided',
    ref: { low: 20, high: 40 },
    note: 'Differential percentage. Elevated in viral infections; low in immune deficiency or steroid use.' },
  'Monocytes': { unit: '%', system: 'Blood & immune', direction: 'two_sided',
    ref: { low: 2, high: 10 },
    note: 'Differential percentage. Mildly elevated values often reflect chronic low-grade inflammation.' },
  'Eosinophils': { unit: '%', system: 'Blood & immune', direction: 'two_sided', ref: { low: 1, high: 6 } },
  'Basophils': { unit: '%', system: 'Blood & immune', direction: 'high_bad', ref: { high: 2 } },
  'Platelets': { unit: 'lakhs/cumm', system: 'Blood & immune', direction: 'two_sided',
    ref: { low: 1.5, high: 4.1 }, critical: { low: 0.5, high: 10 } },
  'Absolute Neutrophil Count': { unit: 'cells/µL', system: 'Blood & immune', direction: 'two_sided',
    ref: { low: 2000, high: 7000 }, critical: { low: 500 }, crossLinks: ['illness'],
    note: 'Absolute count in cells/µL. Low ANC (neutropenia) raises infection risk; <500 is severe.' },
  'Reticulocyte': { unit: '%', system: 'Blood & immune', direction: 'two_sided', ref: { low: 0.5, high: 2.5 },
    note: 'Marrow response marker for the anaemia work-up: high suggests blood loss/haemolysis, low suggests under-production.' },
  'NLR': { unit: 'ratio', system: 'Blood & immune', direction: 'two_sided',
    ref: { low: 0.78, high: 3.53 }, optimal: { high: 2.0 },
    crossLinks: ['stress', 'illness'], note: 'Neutrophil-to-lymphocyte ratio — a general inflammation/stress marker. Values above 3.5 are associated with increased cardiovascular risk.' },

  // ── Acute Phase Reactants → split (hs-CRP→Heart; rest→Blood & immune) ──
  'hs-CRP': { unit: 'mg/L', system: 'Heart', direction: 'high_bad',
    ref: { high: 3 }, optimal: { high: 1 }, critical: { high: 10 },
    crossLinks: ['stress', 'sleep', 'nutrition', 'metabolic', 'central_adiposity'],
    note: '<1 low / 1–3 average / >3 high cardiovascular risk; >10 suggests acute inflammation — interpret the cause.' },
  'ESR': { unit: 'mm/hr', system: 'Blood & immune', direction: 'high_bad', ref: esrUpper, crossLinks: ['illness'] },
  'Ferritin': { unit: 'ng/mL', system: 'Blood & immune', direction: 'two_sided',
    ref: { male: { low: 12, high: 400 }, female: { low: 13, high: 150 } },
    optimal: { male: { low: 30, high: 200 }, female: { low: 20, high: 150 } },
    crossLinks: ['fatigue', 'hair_loss', 'cognition', 'activity'],
    note: 'Acute-phase reactant — read alongside hs-CRP. If hs-CRP is elevated, a normal-looking ferritin can mask iron deficiency. Functional deficiency (symptoms present) can occur at levels below 30 ng/mL even when above the clinical lower limit.' },
  'Serum Iron': { unit: 'µg/dL', system: 'Blood & immune', direction: 'two_sided', ref: { low: 60, high: 170 } },
  'TIBC': { unit: 'µg/dL', system: 'Blood & immune', direction: 'two_sided', ref: { low: 240, high: 450 },
    note: 'High TIBC with low ferritin/iron supports iron deficiency.' },
  'Transferrin Saturation': { unit: '%', system: 'Blood & immune', direction: 'two_sided',
    ref: { low: 20, high: 50 }, crossLinks: ['fatigue'],
    note: '<20% supports iron deficiency; >50% suggests iron overload. Derived = Serum Iron / TIBC × 100.' },

  // ── Vitamins → Vitamins ────────────────────────────────────────────────
  'Vitamin D (25-OH)': { unit: 'ng/mL', system: 'Vitamins', direction: 'low_bad',
    ref: { low: 20 }, optimal: { low: 30, high: 60 }, critical: { low: 10 },
    crossLinks: ['fatigue', 'wellbeing', 'cognition'],
    note: '<10 severe deficiency; 10–20 deficient (out of range); 20–30 insufficient (below optimal — borderline); ≥30 sufficient. Optimal range 40–60 ng/mL. Insufficiency is extremely prevalent in South-Asian populations.' },
  'Folate (B9)': { unit: 'ng/mL', system: 'Vitamins', direction: 'low_bad', ref: { low: 4 }, crossLinks: ['cognition'] },
  'Vitamin B12': { unit: 'pg/mL', system: 'Vitamins', direction: 'low_bad',
    ref: { low: 197 }, optimal: { low: 400 }, crossLinks: ['cognition', 'fatigue'],
    note: '200–300 is borderline and may still be deficient — consider MMA/homocysteine.' },
  'Magnesium': { unit: 'mg/dL', system: 'Vitamins', direction: 'two_sided', ref: { low: 1.6, high: 2.6 },
    crossLinks: ['sleep', 'stress', 'metabolic'], note: 'Serum magnesium underestimates total-body status.' },

  // ── Liver Function → Liver ──────────────────────────────────────────────
  'ALT': { unit: 'U/L', system: 'Liver', direction: 'high_bad',
    ref: { male: { high: 41 }, female: { high: 33 } }, critical: { high: 200 },
    crossLinks: ['metabolic', 'central_adiposity'] },
  'AST': { unit: 'U/L', system: 'Liver', direction: 'high_bad',
    ref: { male: { high: 40 }, female: { high: 31 } }, critical: { high: 200 } },
  'GGT': { unit: 'U/L', system: 'Liver', direction: 'high_bad',
    ref: { male: { high: 60 }, female: { high: 42 } }, crossLinks: ['alcohol', 'metabolic'],
    note: 'Sensitive to alcohol — corroborates the AUDIT-C risk flag.' },
  'ALP': { unit: 'U/L', system: 'Liver', direction: 'two_sided', ref: { low: 35, high: 104 } },
  'Bilirubin': { unit: 'mg/dL', system: 'Liver', direction: 'high_bad', ref: { high: 1.2 },
    note: 'Mild isolated elevation is often benign (e.g., Gilbert\u2019s syndrome).' },
  'Total Protein': { unit: 'g/dL', system: 'Liver', direction: 'two_sided', ref: { low: 6.6, high: 8.7 } },
  'Albumin': { unit: 'g/dL', system: 'Liver', direction: 'low_bad', ref: { low: 3.5, high: 5.2 } },
  'Globulin': { unit: 'g/dL', system: 'Liver', direction: 'two_sided', ref: { low: 1.8, high: 3.8 } },
  'Fatty Liver Index': { unit: 'score', system: 'Liver', direction: 'high_bad',
    ref: { high: 60 }, optimal: { high: 30 }, crossLinks: ['central_adiposity', 'metabolic', 'nutrition'],
    note: '<30 rules out, ≥60 rules in hepatic steatosis.' },

  // ── Kidney Function (+ Urinalysis) → Kidney ─────────────────────────────
  'Creatinine': { unit: 'mg/dL', system: 'Kidney', direction: 'high_bad',
    ref: { male: { high: 1.3, low: 0.7 }, female: { high: 0.90, low: 0.50 } }, critical: { high: 2.0 } },
  'eGFR': { unit: 'mL/min/1.73m²', system: 'Kidney', direction: 'low_bad',
    ref: { low: 90 }, critical: { low: 30 },
    note: 'Use the 2021 race-free CKD-EPI equation — do NOT apply an ethnicity coefficient here. <60 persistent suggests CKD.' },
  'Urea': { unit: 'mg/dL', system: 'Kidney', direction: 'two_sided', ref: { low: 15, high: 40 },
    note: 'Blood urea. Rises with kidney impairment, dehydration, high protein intake, or GI bleeding.' },
  'Uric Acid': { unit: 'mg/dL', system: 'Kidney', direction: 'high_bad',
    ref: { male: { high: 7.0 }, female: { high: 6.0 } }, crossLinks: ['metabolic', 'central_adiposity', 'alcohol'],
    note: 'High uric acid relates to gout risk and clusters with metabolic syndrome.' },
  'BUN/Creatinine Ratio': { unit: 'ratio', system: 'Kidney', direction: 'high_bad', ref: { high: 20 },
    note: '>20 with high-normal creatinine suggests a pre-renal/dehydration picture rather than intrinsic kidney disease.' },
  'Sodium': { unit: 'mmol/L', system: 'Kidney', direction: 'two_sided', ref: { low: 135, high: 145 }, critical: { low: 125, high: 155 } },
  'Potassium': { unit: 'mmol/L', system: 'Kidney', direction: 'two_sided', ref: { low: 3.5, high: 5.1 }, critical: { low: 3.0, high: 6.0 }, referOnAbnormal: true },
  'Chloride': { unit: 'mmol/L', system: 'Kidney', direction: 'two_sided', ref: { low: 98, high: 107 } },
  'Calcium': { unit: 'mg/dL', system: 'Kidney', direction: 'two_sided', ref: { low: 8.6, high: 10.0 }, critical: { low: 7, high: 12 },
    note: 'Correct for albumin where possible.' },
  'Bicarbonate': { unit: 'mmol/L', system: 'Kidney', direction: 'two_sided', ref: { low: 22, high: 29 } },
  // Urinalysis (qualitative)
  'Colour & Transparency': { unit: '', system: 'Kidney', direction: 'qualitative',
    normalValues: ['pale', 'straw', 'yellow', 'clear'], abnormalValues: ['cloudy', 'turbid', 'red', 'brown'] },
  'Protein': { unit: '', system: 'Kidney', direction: 'qualitative',
    normalValues: ['nil', 'negative', 'absent'], abnormalValues: ['trace', '1+', '2+', '3+', 'present'], referOnAbnormal: true,
    note: 'Proteinuria warrants clinical follow-up.' },
  'Glucose': { unit: '', system: 'Metabolic', direction: 'qualitative',
    normalValues: ['nil', 'negative', 'absent'], abnormalValues: ['1+', '2+', '3+', 'present'],
    crossLinks: ['metabolic'], note: 'Glycosuria → check fasting glucose / HbA1c.' },
  'Ketones': { unit: '', system: 'Metabolic', direction: 'qualitative',
    normalValues: ['nil', 'negative', 'absent'], abnormalValues: ['trace', '1+', '2+', 'present'],
    crossLinks: ['metabolic'] },
  'pH': { unit: '', system: 'Kidney', direction: 'two_sided', ref: { low: 4.5, high: 8.0 } },
  'RBC': { unit: '/hpf', system: 'Kidney', direction: 'high_bad', ref: { high: 2 }, referOnAbnormal: true,
    note: 'Haematuria warrants clinical follow-up.' },
  'Pus Cells': { unit: '/hpf', system: 'Kidney', direction: 'high_bad', ref: { high: 5 }, crossLinks: ['illness'],
    note: 'Elevated pus cells / bacteria suggest possible UTI.' },
  'Epithelial Cells': { unit: '/hpf', system: 'Kidney', direction: 'high_bad', ref: { high: 15 } },
  'Casts': { unit: '', system: 'Kidney', direction: 'qualitative',
    normalValues: ['nil', 'absent', 'occasional hyaline', 'none'], abnormalValues: ['cellular', 'granular', 'rbc', 'wbc'], referOnAbnormal: true },
  'Crystals': { unit: '', system: 'Kidney', direction: 'qualitative',
    normalValues: ['nil', 'absent', 'none', 'few'], abnormalValues: [] },
  'Bacteria': { unit: '', system: 'Kidney', direction: 'qualitative',
    normalValues: ['nil', 'absent', 'none'], abnormalValues: ['present', 'numerous', 'many'], crossLinks: ['illness'] },

  // ── Metabolic → Metabolic ───────────────────────────────────────────────
  'Fasting Glucose': { unit: 'mg/dL', system: 'Metabolic', direction: 'high_bad',
    ref: { high: 99, low: 70 }, optimal: { high: 90 }, critical: { high: 250, low: 54 },
    crossLinks: ['afternoon', 'nutrition', 'central_adiposity'],
    note: '100–125 = prediabetes range; ≥126 = diabetes range (refer).' },
  'Fasting Insulin': { unit: 'µIU/mL', system: 'Metabolic', direction: 'high_bad',
    ref: { high: 25 }, optimal: { high: 8 }, crossLinks: ['central_adiposity', 'metabolic'] },
  'HOMA-IR': { unit: 'index', system: 'Metabolic', direction: 'high_bad',
    ref: { high: 2.0 }, optimal: { high: 1.0 }, crossLinks: ['central_adiposity', 'nutrition', 'activity'],
    note: 'Insulin-resistance index, computed = Fasting Glucose (mg/dL) × Fasting Insulin (µU/mL) / 405. >2 suggests resistance; >2.9 is marked.' },
  'HbA1c': { unit: '%', system: 'Metabolic', direction: 'high_bad',
    ref: { high: 5.7 }, optimal: { high: 5.4 }, critical: { high: 9.0 },
    crossLinks: ['afternoon', 'central_adiposity', 'nutrition'],
    note: '<5.7 = normal; 5.7–6.4 = prediabetes range; ≥6.5 = diabetes range (refer).' },

  // ── Lipids & Cardiac → Heart ────────────────────────────────────────────
  'Total Cholesterol': { unit: 'mg/dL', system: 'Heart', direction: 'high_bad', ref: { high: 200 } },
  'HDL': { unit: 'mg/dL', system: 'Heart', direction: 'low_bad',
    ref: { low: 40 }, crossLinks: ['activity'],
    note: '<40 mg/dL is low risk; ≥60 mg/dL is protective. Values 40–60 are within the normal range.' },
  'LDL': { unit: 'mg/dL', system: 'Heart', direction: 'high_bad',
    ref: { high: 130 }, optimal: { high: 100 }, critical: { high: 190 },
    note: '≥190 raises the question of familial hypercholesterolaemia (refer).' },
  'Triglycerides': { unit: 'mg/dL', system: 'Heart', direction: 'high_bad',
    ref: { high: 150 }, critical: { high: 500 }, crossLinks: ['central_adiposity', 'metabolic'],
    note: '≥500 carries pancreatitis risk (refer).' },
  'Non-HDL': { unit: 'mg/dL', system: 'Heart', direction: 'high_bad', ref: { high: 130 }, optimal: { high: 100 } },
  'TC/HDL Ratio': { unit: 'ratio', system: 'Heart', direction: 'high_bad', ref: { high: 5 }, optimal: { high: 3.5 } },
  'TG/HDL Ratio': { unit: 'ratio', system: 'Heart', direction: 'high_bad', ref: { high: 3 }, optimal: { high: 2 },
    crossLinks: ['metabolic', 'central_adiposity'], note: 'A practical insulin-resistance proxy.' },
  'ApoB': { unit: 'mg/dL', system: 'Heart', direction: 'high_bad', ref: { high: 130 }, optimal: { high: 90 },
    note: 'Arguably a better cardiovascular risk marker than LDL.' },
  'Lp(a)': { unit: 'mg/dL', system: 'Heart', direction: 'high_bad', ref: { high: 30 },
    note: 'Largely genetic; a once-in-a-lifetime measurement. Units vary between labs (mg/dL vs nmol/L — 1 mg/dL ≈ 2.5 nmol/L). Confirm units with the lab report.' },

  // ── Thyroid → Thyroid ───────────────────────────────────────────────────
  'TSH': { unit: 'mIU/L', system: 'Thyroid', direction: 'two_sided',
    ref: { low: 0.27, high: 4.20 }, optimal: { low: 0.5, high: 2.5 }, critical: { high: 10 },
    crossLinks: ['fatigue', 'cognition', 'hair_loss', 'cold', 'wellbeing'],
    note: '4–10 with normal FT4 = subclinical hypothyroidism (monitor).' },
  'FT3': { unit: 'pg/mL', system: 'Thyroid', direction: 'two_sided', ref: { low: 2.3, high: 4.2 } },
  'FT4': { unit: 'ng/dL', system: 'Thyroid', direction: 'two_sided', ref: { low: 0.8, high: 1.8 } },
  'Total T3': { unit: 'ng/mL', system: 'Thyroid', direction: 'two_sided', ref: { low: 0.87, high: 1.78 },
    note: 'Total triiodothyronine — mostly protein-bound. Useful alongside FT3 to assess overall thyroid output. Ref 0.87–1.78 ng/mL.' },
  'Total T4': { unit: 'µg/dL', system: 'Thyroid', direction: 'two_sided', ref: { low: 4.5, high: 12.5 },
    note: 'Total thyroxine — includes protein-bound fraction. Ref 4.5–12.5 µg/dL. Elevated in hyperthyroidism, low in hypothyroidism.' },

  // ── Hormones → Hormones ─────────────────────────────────────────────────
  'Morning Cortisol': { unit: 'µg/dL', system: 'Hormones', direction: 'two_sided', ref: { low: 6, high: 18 },
    crossLinks: ['stress'], note: 'A single morning value is a screen only — diurnal pattern (or cortisol:DHEA) is more informative.' },
  'DHEA-S': { unit: 'µg/dL', system: 'Hormones', direction: 'two_sided',
    ref: (ctx) => {
      // Declines with age; broad sex/age bands.
      const a = ctx.age ?? 40
      if (ctx.sex === 'female') return a < 40 ? { low: 98.8, high: 340 } : { low: 30, high: 200 }
      return a < 40 ? { low: 110, high: 510 } : { low: 70, high: 310 }
    }, crossLinks: ['stress', 'wellbeing'] },
  'SHBG': { unit: 'nmol/L', system: 'Hormones', direction: 'two_sided',
    ref: { male: { low: 18, high: 54 }, female: { low: 32.4, high: 128 } },
    note: 'Interpret with testosterone or oestradiol to gauge free hormone availability.' },
  'Total Testosterone': { unit: 'ng/mL', system: 'Hormones', direction: 'two_sided',
    ref: { male: { low: 3.0, high: 10.0 }, female: { low: 0.084, high: 0.481 } },
    crossLinks: ['low_libido', 'fatigue', 'mood', 'activity'],
    note: 'Female ref 0.084–0.481 ng/mL; male ref 3.0–10.0 ng/mL. Measure morning, fasting.' },
  'Free Testosterone (men)': { unit: 'pg/mL', system: 'Hormones', direction: 'low_bad', ref: { low: 9, high: 30 },
    crossLinks: ['low_libido', 'fatigue'] },
  'Estradiol (women)': { unit: 'pg/mL', system: 'Hormones', direction: 'two_sided',
    ref: { low: 30, high: 400 }, crossLinks: ['low_libido', 'wellbeing'],
    note: 'Broad follicular-to-luteal reference range shown. Interpretation requires cycle phase context; midcycle values may transiently exceed the upper bound.' },
  'FSH (women)': { unit: 'mIU/mL', system: 'Hormones', direction: 'two_sided',
    ref: { low: 1.5, high: 12 },
    note: 'Follicular-phase reference range. FSH rises during ovulation and the menopausal transition; interpret in that context.' },
  'LH (women)': { unit: 'mIU/mL', system: 'Hormones', direction: 'two_sided',
    ref: { low: 1.9, high: 12.5 },
    note: 'Follicular-phase reference range. LH surges dramatically at ovulation; interpret with FSH and cycle timing.' },

  // ── Allergy Panel → Blood & immune ──────────────────────────────────────
  'Total IgE': { unit: 'IU/mL', system: 'Blood & immune', direction: 'high_bad', ref: { high: 100 },
    crossLinks: ['illness'], note: 'Elevated total IgE suggests atopy/allergy; interpret with eosinophils and allergy history.' },

  // ── Derived indices (computed in interpretPanel; not OCR-extracted) ───────
  // Each is injected as a 'derived' biomarker so it gets a tier and feeds the system rollup.
  'FIB-4': { unit: 'index', system: 'Liver', direction: 'high_bad',
    ref: { high: 2.67 }, optimal: { high: 1.30 },
    crossLinks: ['metabolic', 'central_adiposity', 'alcohol'],
    note: 'Liver-fibrosis risk = (Age × AST) / (Platelets × √ALT). <1.30 low, 1.30–2.67 indeterminate, >2.67 high. Best validated ages 35–65; for ≥65 the low-risk cut-off rises to 2.0.' },
  'TyG Index': { unit: 'index', system: 'Metabolic', direction: 'high_bad',
    ref: { high: 8.8 }, optimal: { high: 8.5 }, crossLinks: ['central_adiposity', 'nutrition', 'activity'],
    note: 'Triglyceride-glucose index = ln(Triglycerides × Fasting Glucose / 2); an insulin-resistance surrogate. Thresholds are population-dependent.' },
  'Remnant Cholesterol': { unit: 'mg/dL', system: 'Heart', direction: 'high_bad',
    ref: { high: 30 }, optimal: { high: 24 }, crossLinks: ['metabolic', 'central_adiposity'],
    note: 'Total Cholesterol − HDL − LDL; the atherogenic cholesterol carried by triglyceride-rich remnants, a source of residual cardiovascular risk.' },
  'A/G Ratio': { unit: 'ratio', system: 'Liver', direction: 'two_sided', ref: { low: 1.1, high: 2.5 },
    note: 'Albumin / Globulin. Low (<1.1) can reflect chronic inflammation or liver synthetic issues; high can reflect dehydration.' },
  'Corrected Calcium': { unit: 'mg/dL', system: 'Kidney', direction: 'two_sided', ref: { low: 8.5, high: 10.5 }, critical: { low: 7, high: 12 },
    note: 'Albumin-corrected calcium = Calcium + 0.8 × (4.0 − Albumin); a truer calcium when albumin is abnormal.' },
  'LH/FSH Ratio': { unit: 'ratio', system: 'Hormones', direction: 'context', ref: { high: 2 },
    note: 'LH:FSH > 2 in a pre-menopausal woman can support a PCOS picture; cycle timing strongly affects it.' },
  'VLDL Cholesterol': { unit: 'mg/dL', system: 'Heart', direction: 'high_bad',
    ref: { high: 40 }, optimal: { high: 30 },
    note: 'Estimated VLDL = Triglycerides ÷ 5 (Friedewald). Valid when TG < 400 mg/dL. Elevations mirror high triglycerides and signal atherogenic dyslipidaemia.' },
  'AIP': { unit: 'index', system: 'Heart', direction: 'high_bad',
    ref: { high: 0.21 }, optimal: { high: 0.11 },
    note: 'Atherogenic Index of Plasma = log10(TG [mmol/L] / HDL [mmol/L]). <0.11 low risk, 0.11-0.21 borderline, >0.21 high cardiovascular risk. More sensitive than TG/HDL ratio alone.' },
  'FAI': { unit: 'index', system: 'Hormones', direction: 'high_bad',
    ref: { male: { high: 90 }, female: { high: 6.3 } },
    optimal: { male: { high: 60 }, female: { high: 4.0 } },
    note: 'Free Androgen Index = (TT [ng/mL] × 346.7) / SHBG [nmol/L] = (TT [nmol/L] / SHBG [nmol/L]) × 100. Female >6.3 suggests androgen excess / PCOS; male >90 is rarely physiologic.' },
  'DHEA-S:Cortisol': { unit: 'ratio', system: 'Hormones', direction: 'two_sided',
    ref: { low: 5, high: 25 },
    note: 'DHEA-S (µg/dL) / Morning Cortisol (µg/dL). A low ratio suggests cortisol dominance or adrenal fatigue; a high ratio may indicate excess DHEA. Reference range is approximate.' },
  'Anion Gap': { unit: 'mmol/L', system: 'Kidney', direction: 'two_sided',
    ref: { low: 8, high: 16 },
    note: 'Sodium - (Chloride + Bicarbonate). Elevated >16 mmol/L signals metabolic acidosis; low values (<8) can indicate hypoalbuminaemia or lab error.' },
}
