// lib/findings-config.ts
//
// Layer 3 rule library (expanded). Each rule consolidates Layer-1 (questionnaire) + Layer-2 (lab)
// signals into a single coherent finding. Rules pattern over the ALREADY-COMPUTED tiers/flags/values
// from earlier layers — clinical thresholds live in lab-config.ts / clinical-config.ts. A few rules
// reference well-known DIAGNOSTIC cut-points (e.g. HbA1c >= 6.5) to decide referral; those are noted.
//
// Tone: wellness-discovery, non-diagnostic. `refer: true` routes the person to a clinician and is
// never buried by the engine. `kind: 'strength'` marks positive findings (what is going well).

import type { BodySystem } from './lab-config'
import type { BiomarkerTier } from './lab-interpretation'

export type Severity = 'info' | 'low' | 'moderate' | 'high' | 'urgent'
export type FindingConfidence = 'low' | 'moderate' | 'high'
export type Pillar = 'Nourish' | 'Move' | 'Calm' | 'Clinical'
export type Sex = 'male' | 'female' | 'unknown'

export interface FindingContext {
  tier: (name: string) => BiomarkerTier
  abnormal: (name: string) => boolean        // out_of_range | critical
  watchOrWorse: (name: string) => boolean     // watch | out_of_range | critical
  below: (name: string) => boolean            // numeric value < reference low
  above: (name: string) => boolean            // numeric value > reference high
  value: (name: string) => number | null      // raw numeric value (for ratios / gradation)
  refer: (name: string) => boolean
  hasFlag: (name: string, flag: string) => boolean
  domainLow: (domain: string) => boolean       // wellness < 50
  domainScore: (domain: string) => number      // 0-100 (100 if absent)
  domainFlag: (domain: string, flag: string) => boolean
  symptom: (re: RegExp) => boolean
  anthro: (re: RegExp) => boolean
  alcoholRisk: boolean
  condition: (re: RegExp) => boolean           // history.conditions
  familyHistory: (re: RegExp) => boolean
  medication: (re: RegExp) => boolean          // history.medications + free text
  diet: (re: RegExp) => boolean
  sex: Sex
  age: number | null
  smoker: boolean
  menopausal: boolean
  bpSystolic: number | null                    // resting BP from history (optional)
  bpDiastolic: number | null
}

export interface RuleHit {
  biomarkers: string[]
  signals: string[]            // human-readable self-report / history corroborators
  baseSeverity: Severity
  detail: string
  refer?: boolean
  managedNote?: string
  priorityBoost?: number       // e.g. raise priority when family-history risk is present
}

export interface FindingRule {
  id: string
  title: string | ((c: FindingContext) => string)
  system: BodySystem | 'Cross-system'
  pillars: Pillar[]
  kind?: 'concern' | 'strength' // default 'concern'
  detect: (c: FindingContext) => RuleHit | null
}

// energy/fatigue is not a single questionnaire item: low activity/wellbeing + crash symptoms.
const lowEnergy = (c: FindingContext) =>
  c.domainLow('activity') || c.domainLow('wellbeing') || c.symptom(/motivation|afternoon|crash/)

export const FINDING_RULES: FindingRule[] = [
  // ============================ Blood & immune ============================
  {
    id: 'iron_deficiency', title: 'Low iron stores', system: 'Blood & immune',
    pillars: ['Nourish', 'Clinical'],
    detect: (c) => {
      const iron: string[] = []
      if (c.below('Ferritin')) iron.push('Ferritin')
      if (c.below('Transferrin Saturation')) iron.push('Transferrin Saturation')
      if (c.below('Serum Iron')) iron.push('Serum Iron')
      if (c.above('TIBC')) iron.push('TIBC')
      const microHypochromic = c.below('Haemoglobin') && c.below('MCV') && c.above('RDW')
      if (iron.length === 0 && !microHypochromic) return null
      const anaemia = c.below('Haemoglobin')
      const biomarkers = [...iron]
      if (anaemia) biomarkers.push('Haemoglobin')
      if (c.below('MCV')) biomarkers.push('MCV')
      if (c.above('RDW')) biomarkers.push('RDW')
      const signals: string[] = []
      if (lowEnergy(c)) signals.push('low energy / fatigue')
      if (c.symptom(/hair_loss/)) signals.push('hair loss')
      const masked = c.hasFlag('Ferritin', 'iron_status_uncertain_inflammation')
      return {
        biomarkers, signals,
        baseSeverity: anaemia ? (c.refer('Haemoglobin') ? 'urgent' : 'high') : 'moderate',
        refer: c.refer('Haemoglobin'),
        detail: anaemia
          ? 'A pattern of low iron stores with anaemia. Iron-rich foods help, and the cause of the anaemia is worth confirming with a clinician.'
          : 'Iron stores look low even if the blood count is still normal, a common and very correctable driver of fatigue.',
        managedNote: masked ? 'hs-CRP is raised, so ferritin can read falsely normal; iron status may be worse than it looks.' : undefined,
      }
    },
  },
  {
    id: 'anemia_inflammatory', title: 'Anaemia with inflammation', system: 'Blood & immune',
    pillars: ['Clinical', 'Calm'],
    detect: (c) => {
      // Normocytic anaemia + inflammation + preserved iron stores: points away from iron deficiency.
      if (!(c.below('Haemoglobin') && !c.below('MCV') && !c.below('Ferritin') && (c.above('hs-CRP') || c.above('ESR')))) return null
      const biomarkers = ['Haemoglobin', c.above('hs-CRP') ? 'hs-CRP' : 'ESR', 'Ferritin']
      return {
        biomarkers, signals: lowEnergy(c) ? ['low energy'] : [],
        baseSeverity: 'high', refer: true,
        detail: 'Anaemia alongside inflammation with preserved iron stores points away from simple iron deficiency; the inflammatory cause is worth investigating.',
      }
    },
  },
  {
    id: 'possible_infection', title: 'Raised white cells', system: 'Blood & immune', pillars: ['Clinical'],
    detect: (c) => {
      if (!(c.above('White Blood Cells') || c.above('Neutrophils'))) return null
      const biomarkers = ['White Blood Cells', 'Neutrophils'].filter(n => c.above(n))
      return {
        biomarkers, signals: c.symptom(/illness/) ? ['recent illness'] : [],
        baseSeverity: c.refer('White Blood Cells') ? 'high' : 'moderate', refer: c.refer('White Blood Cells'),
        detail: 'White cells are raised, which can reflect a current infection or active inflammation; worth a clinical check if it persists.',
      }
    },
  },
  {
    id: 'platelet_abnormal', title: 'Platelet count outside range', system: 'Blood & immune', pillars: ['Clinical'],
    detect: (c) => {
      if (!c.abnormal('Platelets')) return null
      return {
        biomarkers: ['Platelets'], signals: [],
        baseSeverity: c.refer('Platelets') ? 'urgent' : 'moderate', refer: c.refer('Platelets'),
        detail: 'The platelet count is outside the reference range; a clinician can interpret whether this needs follow-up.',
      }
    },
  },

  {
    id: 'allergy_atopy', title: 'Allergic sensitisation pattern', system: 'Blood & immune', pillars: ['Nourish', 'Clinical'],
    detect: (c) => {
      if (!c.above('Total IgE')) return null
      const biomarkers = ['Total IgE']
      const signals: string[] = []
      if (c.above('Eosinophils')) { biomarkers.push('Eosinophils'); signals.push('eosinophilia') }
      if (c.symptom(/breath|skin|itch|sneez|rash/)) signals.push('allergic symptoms reported')
      return {
        biomarkers, signals,
        baseSeverity: c.above('Eosinophils') ? 'moderate' : 'low',
        detail: 'Total IgE is raised, pointing to an atopic (allergic) tendency. Identifying specific triggers (food, environmental) and supporting gut and immune health through an anti-inflammatory diet can reduce the overall allergic load.',
      }
    },
  },

  // ============================ Inflammation ============================
  {
    id: 'inflammation', title: 'Inflammatory load', system: 'Heart', pillars: ['Calm', 'Nourish'],
    detect: (c) => {
      const core = ['hs-CRP', 'ESR', 'NLR'].filter(n => c.above(n))
      if (core.length === 0) return null // anchor on a true inflammatory marker
      const broader = [...core]
      if (c.above('RDW')) broader.push('RDW')
      if (c.below('Albumin')) broader.push('Albumin')
      if (c.above('Ferritin') && !c.below('Transferrin Saturation')) broader.push('Ferritin')
      const signals: string[] = []
      if (c.domainLow('stress')) signals.push('high perceived stress')
      if (c.domainLow('sleep')) signals.push('poor sleep')
      if (c.anthro(/adiposity|obese|waist/)) signals.push('central adiposity')
      const heavy = c.refer('hs-CRP') || broader.length >= 3
      return {
        biomarkers: broader, signals,
        baseSeverity: heavy ? 'high' : 'moderate',
        detail: heavy
          ? 'Several markers converge on a meaningful systemic inflammatory load; identifying and addressing the driver (stress, sleep, central fat, diet, or an active process) is worthwhile.'
          : 'A low-grade inflammatory signal, often linked to stress, sleep, central fat, and diet.',
      }
    },
  },

  // ============================ Vitamins / minerals ============================
  {
    id: 'vitamin_d_low', title: 'Low vitamin D', system: 'Vitamins', pillars: ['Nourish'],
    detect: (c) => {
      if (!c.below('Vitamin D (25-OH)')) return null
      const v = c.value('Vitamin D (25-OH)')
      const signals: string[] = []
      if (lowEnergy(c)) signals.push('low energy')
      if (c.domainLow('wellbeing')) signals.push('low mood/wellbeing')
      return {
        biomarkers: ['Vitamin D (25-OH)'], signals,
        baseSeverity: c.refer('Vitamin D (25-OH)') ? 'high' : (v !== null && v < 20) ? 'moderate' : 'low',
        detail: 'Vitamin D is below the sufficiency range, very common in South-Asian populations and easily addressed with sunlight, diet, and often supplementation.',
      }
    },
  },
  {
    id: 'b12_folate_low', title: (c) => (c.below('Haemoglobin') && c.above('MCV') ? 'Macrocytic anaemia (B12/folate)' : 'Low B12 / folate'),
    system: 'Vitamins', pillars: ['Nourish'],
    detect: (c) => {
      const b: string[] = []
      if (c.watchOrWorse('Vitamin B12')) b.push('Vitamin B12')
      if (c.below('Folate (B9)')) b.push('Folate (B9)')
      if (b.length === 0) return null
      const macroAnaemia = c.below('Haemoglobin') && c.above('MCV')
      if (macroAnaemia) b.push('MCV', 'Haemoglobin')
      const signals: string[] = []
      if (c.domainLow('cognition')) signals.push('reduced mental clarity')
      if (lowEnergy(c)) signals.push('low energy')
      if (c.diet(/vegan|vegetarian/)) signals.push('plant-based diet')
      return {
        biomarkers: b, signals,
        baseSeverity: macroAnaemia ? 'high' : (c.abnormal('Vitamin B12') || c.below('Folate (B9)')) ? 'moderate' : 'low',
        detail: macroAnaemia
          ? 'Enlarged red cells with anaemia and low B12/folate is a classic macrocytic pattern; replacing the deficient vitamin usually resolves it.'
          : 'B12/folate is low or borderline. Both support energy and cognition, and a plant-based diet raises B12 risk specifically.',
      }
    },
  },
  {
    id: 'magnesium_low', title: 'Low magnesium', system: 'Vitamins', pillars: ['Nourish', 'Calm'],
    detect: (c) => {
      if (!c.below('Magnesium')) return null
      const signals: string[] = []
      if (c.domainLow('sleep')) signals.push('poor sleep')
      if (c.domainLow('stress')) signals.push('high stress')
      return {
        biomarkers: ['Magnesium'], signals, baseSeverity: 'low',
        detail: 'Magnesium is on the low side; it supports sleep, stress regulation, and glucose handling, and serum levels tend to understate the true picture.',
      }
    },
  },

  // ============================ Metabolic ============================
  {
    id: 'insulin_resistance', title: 'Insulin-resistance / metabolic pattern', system: 'Metabolic',
    pillars: ['Nourish', 'Move'],
    detect: (c) => {
      const hits: string[] = []
      if (c.watchOrWorse('HOMA-IR')) hits.push('HOMA-IR')
      if (c.watchOrWorse('HbA1c')) hits.push('HbA1c')
      if (c.above('Fasting Glucose')) hits.push('Fasting Glucose')
      if (c.above('Fasting Insulin')) hits.push('Fasting Insulin')
      if (c.watchOrWorse('TG/HDL Ratio')) hits.push('TG/HDL Ratio')
      if (c.watchOrWorse('TyG Index')) hits.push('TyG Index')
      if (c.above('Triglycerides')) hits.push('Triglycerides')
      if (c.watchOrWorse('Fatty Liver Index')) hits.push('Fatty Liver Index')
      const adipose = c.anthro(/adiposity|obese|waist/)
      if (hits.length < 2 && !(hits.length >= 1 && adipose)) return null
      const a1c = c.value('HbA1c'); const glu = c.value('Fasting Glucose')
      // Diagnostic cut-points (HbA1c >= 6.5%, fasting glucose >= 126 mg/dL) trigger a referral.
      const diabetes = (a1c !== null && a1c >= 6.5) || (glu !== null && glu >= 126) || c.refer('HbA1c') || c.refer('Fasting Glucose')
      const signals: string[] = []
      if (adipose) signals.push('central adiposity')
      if (c.domainLow('nutrition')) signals.push('diet quality')
      if (c.symptom(/afternoon|crash/)) signals.push('afternoon energy dips')
      const famDiab = c.familyHistory(/diabet/)
      if (famDiab) signals.push('family history of diabetes')
      return {
        biomarkers: hits, signals,
        baseSeverity: diabetes ? 'urgent' : (c.abnormal('HbA1c') || c.abnormal('Fasting Glucose') || c.abnormal('HOMA-IR')) ? 'high' : 'moderate',
        refer: diabetes,
        priorityBoost: famDiab ? 10 : 0,
        detail: diabetes
          ? 'Several markers point to dysglycaemia in a range that warrants medical review alongside lifestyle work.'
          : 'A cluster of markers pointing toward early insulin resistance, highly responsive to diet, movement, and reducing central fat.',
        managedNote: c.condition(/diabet/) ? 'You have noted diabetes; these reflect ongoing management and are best reviewed with your clinician.' : undefined,
      }
    },
  },
  {
    id: 'metabolic_syndrome', title: 'Metabolic syndrome pattern', system: 'Metabolic', pillars: ['Nourish', 'Move'],
    detect: (c) => {
      // ATP III / IDF: >=3 of 5 criteria. Waist from anthropometrics, BP from history if present.
      const tg = c.value('Triglycerides'); const glu = c.value('Fasting Glucose')
      const crit: string[] = []
      if (c.anthro(/adiposity|obese|waist/)) crit.push('central adiposity')
      if (c.below('HDL')) crit.push('low HDL')
      if ((tg !== null && tg >= 150) || c.above('Triglycerides')) crit.push('high triglycerides')
      if ((glu !== null && glu >= 100) || c.above('Fasting Glucose')) crit.push('elevated fasting glucose')
      if ((c.bpSystolic !== null && c.bpSystolic >= 130) || (c.bpDiastolic !== null && c.bpDiastolic >= 85)) crit.push('raised blood pressure')
      if (crit.length < 3) return null
      const biomarkers = ['Triglycerides', 'HDL', 'Fasting Glucose'].filter(n => c.watchOrWorse(n) || c.below(n))
      return {
        biomarkers, signals: crit,
        baseSeverity: 'high',
        priorityBoost: c.familyHistory(/diabet|cardio|heart/) ? 10 : 0,
        detail: `Meets ${crit.length} of 5 metabolic-syndrome criteria (${crit.join(', ')}) — a clustering that raises diabetes and cardiovascular risk together and responds strongly to diet, movement, and weight.`,
      }
    },
  },

  // ============================ Heart / lipids ============================
  {
    id: 'dyslipidemia', title: 'Atherogenic lipid pattern', system: 'Heart', pillars: ['Nourish', 'Move'],
    detect: (c) => {
      const lip = ['LDL', 'ApoB', 'Non-HDL', 'TC/HDL Ratio', 'Total Cholesterol', 'Lp(a)', 'Remnant Cholesterol'].filter(n => c.above(n))
      if (c.below('HDL')) lip.push('HDL')
      if (c.above('AIP')) lip.push('AIP')
      if (lip.length === 0) return null
      const signals: string[] = []
      if (c.domainLow('activity')) signals.push('low activity')
      if (c.domainLow('nutrition')) signals.push('diet quality')
      const famCvd = c.familyHistory(/cardio|heart|cholesterol|stroke/)
      if (famCvd) signals.push('family history of heart disease')
      // Secondary prevention: known CVD/diabetes → tighter target, so an above-optimal LDL matters more.
      const secondary = c.condition(/cardio|heart|stroke|diabet/)
      const ldlAboveOptimal = c.watchOrWorse('LDL') || c.above('LDL')
      if (secondary && ldlAboveOptimal && lip.indexOf('LDL') === -1) lip.push('LDL')
      return {
        biomarkers: lip, signals,
        baseSeverity: c.refer('LDL') ? 'urgent' : (secondary && ldlAboveOptimal) ? 'high' : (c.abnormal('LDL') || c.abnormal('ApoB') || c.abnormal('Non-HDL')) ? 'high' : 'moderate',
        refer: c.refer('LDL') || (secondary && ldlAboveOptimal),
        priorityBoost: (famCvd ? 10 : 0) + (secondary ? 10 : 0),
        managedNote: secondary ? 'With your cardiovascular/diabetes history, target LDL is lower than the general range — discuss tighter goals with your clinician.' : undefined,
        detail: c.refer('LDL')
          ? 'LDL is in a markedly high range, worth a clinical conversation (including about inherited causes) alongside diet and exercise.'
          : 'Cholesterol markers tied to cardiovascular risk are elevated, responsive to dietary fats, fibre, and activity.'
          + (c.above('Lp(a)') ? ' Raised Lp(a) is largely genetic and informs overall risk.' : ''),
      }
    },
  },

  // ============================ Liver ============================
  {
    id: 'liver_stress',
    title: (c) => (c.alcoholRisk && c.above('GGT') ? 'Liver stress with alcohol pattern' : 'Liver enzyme elevation'),
    system: 'Liver', pillars: ['Nourish', 'Move'],
    detect: (c) => {
      const ast = c.value('AST'), alt = c.value('ALT')
      if (ast !== null && alt && ast / alt >= 2 && (c.above('AST') || c.above('GGT'))) return null // alcohol_liver_ratio handles this
      const liver = ['ALT', 'AST', 'GGT'].filter(n => c.above(n))
      if (c.watchOrWorse('Fatty Liver Index')) liver.push('Fatty Liver Index')
      if (liver.length === 0) return null
      const signals: string[] = []
      if (c.anthro(/adiposity|obese|waist/)) signals.push('central adiposity')
      if (c.alcoholRisk && c.above('GGT')) signals.push('higher-risk alcohol use')
      const refer = c.refer('ALT') || c.refer('AST')
      return {
        biomarkers: liver, signals, baseSeverity: refer ? 'high' : 'moderate', refer,
        detail: 'Liver markers are above range, most often reflecting fatty liver from metabolic load or alcohol, both improvable.',
      }
    },
  },
  {
    id: 'alcohol_liver_ratio', title: 'Alcohol-pattern liver markers', system: 'Liver', pillars: ['Calm', 'Clinical'],
    detect: (c) => {
      const ast = c.value('AST'), alt = c.value('ALT')
      if (ast === null || !alt) return null
      if (ast / alt < 2 || !(c.above('AST') || c.above('GGT'))) return null
      return {
        biomarkers: ['AST', 'ALT', ...(c.above('GGT') ? ['GGT'] : [])],
        signals: c.alcoholRisk ? ['higher-risk alcohol use'] : [],
        baseSeverity: 'moderate',
        detail: 'An AST:ALT ratio above 2 with raised enzymes is a pattern often associated with alcohol-related liver stress.',
      }
    },
  },
  {
    id: 'liver_fibrosis_risk',
    title: (c) => { const v = c.value('FIB-4'); return v !== null && v > 2.67 ? 'Elevated liver-fibrosis risk (FIB-4)' : 'Indeterminate liver-fibrosis risk (FIB-4)' },
    system: 'Liver', pillars: ['Nourish', 'Move', 'Clinical'],
    detect: (c) => {
      if (!c.watchOrWorse('FIB-4')) return null // optimal (<1.30) does not fire
      const high = c.above('FIB-4') // > 2.67
      const signals: string[] = []
      if (c.anthro(/adiposity|obese|waist/)) signals.push('central adiposity')
      if (c.watchOrWorse('HOMA-IR') || c.watchOrWorse('HbA1c')) signals.push('insulin resistance')
      if (c.alcoholRisk) signals.push('higher-risk alcohol use')
      return {
        biomarkers: ['FIB-4', ...['AST', 'ALT', 'Platelets'].filter(n => c.abnormal(n))],
        signals,
        baseSeverity: high ? 'high' : 'moderate',
        refer: high,
        detail: high
          ? 'The FIB-4 index falls in the high-risk band for advanced liver fibrosis — this warrants clinical assessment (e.g. FibroScan), alongside metabolic and alcohol changes.'
          : 'The FIB-4 index is in the indeterminate band — not low risk, worth re-checking and addressing metabolic and alcohol drivers; a clinician may consider further imaging.',
      }
    },
  },

  {
    id: 'low_ag_ratio', title: 'Low albumin-to-globulin ratio', system: 'Liver', pillars: ['Clinical'],
    detect: (c) => {
      if (!c.below('A/G Ratio')) return null
      const biomarkers = ['A/G Ratio']
      const signals: string[] = []
      if (c.below('Albumin')) { biomarkers.push('Albumin'); signals.push('low albumin') }
      if (c.above('Globulin')) { biomarkers.push('Globulin'); signals.push('raised globulin') }
      if (c.above('hs-CRP') || c.above('ESR')) signals.push('inflammation present')
      return {
        biomarkers, signals,
        baseSeverity: 'moderate', refer: true,
        detail: 'A low albumin-to-globulin ratio can reflect reduced albumin production (a liver synthetic issue) or raised globulin (chronic inflammation, immune activation, or rarely a monoclonal protein). A clinician can determine which is driving it.',
      }
    },
  },

  // ============================ Kidney (incl. urinalysis) ============================
  {
    id: 'kidney_function', title: 'Kidney markers need review', system: 'Kidney', pillars: ['Clinical'],
    detect: (c) => {
      const k: string[] = []
      if (c.below('eGFR')) k.push('eGFR')
      if (c.above('Creatinine')) k.push('Creatinine')
      if (c.abnormal('Protein')) k.push('Protein (urine)')
      if (c.abnormal('RBC')) k.push('RBC (urine)')
      if (c.abnormal('Casts')) k.push('Casts (urine)')
      if (k.length === 0) return null
      return {
        biomarkers: k, signals: [],
        baseSeverity: c.refer('eGFR') ? 'urgent' : (c.abnormal('eGFR') || c.abnormal('Protein') || c.abnormal('RBC')) ? 'high' : 'moderate',
        refer: true,
        detail: 'One or more kidney markers are outside range; these are best interpreted by a clinician rather than self-managed.',
      }
    },
  },
  {
    id: 'possible_uti', title: 'Possible urinary infection', system: 'Kidney', pillars: ['Clinical'],
    detect: (c) => {
      if (!(c.above('Pus Cells') || c.abnormal('Bacteria'))) return null
      return {
        biomarkers: ['Pus Cells', 'Bacteria'].filter(n => c.watchOrWorse(n) || c.abnormal(n)),
        signals: c.symptom(/illness/) ? ['recent illness'] : [], baseSeverity: 'moderate', refer: true,
        detail: 'Urine shows signs that can indicate a urinary tract infection; worth a clinical check.',
      }
    },
  },
  {
    id: 'electrolyte', title: 'Electrolyte imbalance', system: 'Kidney', pillars: ['Clinical'],
    detect: (c) => {
      const e = ['Potassium', 'Sodium', 'Calcium', 'Bicarbonate', 'Chloride'].filter(n => c.abnormal(n))
      if (e.length === 0) return null
      const urgent = e.some(n => c.refer(n))
      return {
        biomarkers: e, signals: [], baseSeverity: urgent ? 'urgent' : 'high', refer: true,
        detail: 'An electrolyte is outside range; this should be reviewed by a clinician.',
      }
    },
  },

  {
    id: 'anion_gap_elevated', title: 'Elevated anion gap', system: 'Kidney', pillars: ['Clinical'],
    detect: (c) => {
      if (!c.above('Anion Gap')) return null
      const biomarkers = ['Anion Gap']
      if (c.above('Creatinine') || c.below('eGFR')) biomarkers.push('Creatinine')
      if (c.above('Fasting Glucose') || c.abnormal('HbA1c')) biomarkers.push('Fasting Glucose')
      return {
        biomarkers, signals: [],
        baseSeverity: 'high', refer: true,
        detail: 'The anion gap is elevated, indicating an acid–base disturbance. This warrants clinical evaluation to identify the underlying cause (kidney impairment, blood sugar dysregulation, lactic acidosis, or other metabolic factors).',
      }
    },
  },
  {
    id: 'hyperuricemia', title: 'Elevated uric acid', system: 'Kidney', pillars: ['Nourish'],
    detect: (c) => {
      if (!c.above('Uric Acid')) return null
      const signals: string[] = []
      if (c.anthro(/adiposity|obese|waist/)) signals.push('central adiposity')
      if (c.alcoholRisk) signals.push('higher-risk alcohol use')
      if (c.watchOrWorse('HOMA-IR') || c.watchOrWorse('TG/HDL Ratio')) signals.push('metabolic resistance signals')
      return {
        biomarkers: ['Uric Acid'], signals,
        baseSeverity: c.refer('Uric Acid') ? 'high' : 'moderate',
        refer: c.refer('Uric Acid'),
        detail: 'Uric acid is above the reference range. Beyond gout risk, hyperuricemia tracks closely with insulin resistance, central adiposity, and high fructose or alcohol intake — all modifiable with diet and activity.',
      }
    },
  },

  // ============================ Thyroid ============================
  {
    id: 'thyroid_hypo',
    title: (c) => (c.below('FT4') ? 'Likely hypothyroidism' : 'Subclinical hypothyroid pattern'),
    system: 'Thyroid', pillars: ['Clinical'],
    detect: (c) => {
      if (!c.above('TSH')) return null
      const overt = c.below('FT4')
      const biomarkers = ['TSH']
      if (overt) biomarkers.push('FT4')
      const signals: string[] = []
      if (lowEnergy(c)) signals.push('low energy')
      if (c.domainLow('cognition')) signals.push('mental fog')
      if (c.symptom(/hair_loss/)) signals.push('hair loss')
      if (c.symptom(/cold/)) signals.push('cold intolerance')
      return {
        biomarkers, signals,
        baseSeverity: c.refer('TSH') || overt ? 'high' : 'moderate',
        refer: c.refer('TSH') || overt,
        detail: overt
          ? 'TSH is raised with a low FT4, a pattern consistent with hypothyroidism, worth confirming with a clinician.'
          : 'TSH is mildly raised with normal FT4 (a subclinical pattern), usually monitored and re-checked.',
        managedNote: c.condition(/thyroid|hypothyroid/) ? 'You have noted a thyroid condition; share this with your clinician for a possible dose review.' : undefined,
      }
    },
  },
  {
    id: 'thyroid_hyper', title: 'Overactive thyroid pattern', system: 'Thyroid', pillars: ['Clinical'],
    detect: (c) => {
      if (!(c.below('TSH') && (c.above('FT4') || c.above('FT3')))) return null
      const biomarkers = ['TSH', ...['FT4', 'FT3'].filter(n => c.above(n))]
      return {
        biomarkers, signals: [], baseSeverity: 'high', refer: true,
        detail: 'Suppressed TSH with raised thyroid hormone suggests an overactive thyroid, worth prompt clinical review.',
        managedNote: c.condition(/thyroid|hyperthyroid|graves/) ? 'You have noted a thyroid condition; discuss with your clinician.' : undefined,
      }
    },
  },

  // ============================ Hormones ============================
  {
    id: 'low_testosterone_men', title: 'Low testosterone', system: 'Hormones', pillars: ['Move', 'Clinical'],
    detect: (c) => {
      if (c.sex !== 'male') return null
      const t = ['Total Testosterone', 'Free Testosterone (men)'].filter(n => c.below(n))
      if (t.length === 0) return null
      const signals: string[] = []
      if (c.symptom(/libido/)) signals.push('low libido')
      if (lowEnergy(c)) signals.push('low energy')
      if (c.domainLow('wellbeing')) signals.push('low mood')
      return {
        biomarkers: t, signals, baseSeverity: 'moderate',
        detail: 'Testosterone is below range. Confirm on a morning, fasting sample; strength training, sleep, and body weight all influence it.',
      }
    },
  },
  {
    id: 'adrenal_stress', title: 'Stress-hormone pattern', system: 'Hormones', pillars: ['Calm'],
    detect: (c) => {
      const cort = c.value('Morning Cortisol'), dhea = c.value('DHEA-S')
      const highRatio = cort !== null && dhea !== null && dhea > 0 && (cort / dhea) > 0.2
      const lowDheaCortRatio = c.below('DHEA-S:Cortisol')
      const fired = c.above('Morning Cortisol') || (c.below('DHEA-S') && c.domainLow('stress')) || (highRatio && c.domainLow('stress')) || lowDheaCortRatio
      if (!fired) return null
      const biomarkers = ['Morning Cortisol', 'DHEA-S'].filter(n => c.above(n) || c.below(n))
      if (lowDheaCortRatio && !biomarkers.includes('DHEA-S:Cortisol')) biomarkers.push('DHEA-S:Cortisol')
      const signals = c.domainLow('stress') ? ['high perceived stress'] : []
      return {
        biomarkers: biomarkers.length ? biomarkers : ['Morning Cortisol'], signals, baseSeverity: 'moderate',
        detail: 'Stress hormones and your self-reported stress align. A low DHEA-S:Cortisol ratio reflects cortisol dominance; recovery, sleep, and breathwork are the primary levers.',
      }
    },
  },

  {
    id: 'high_androgen_women', title: 'Androgen excess pattern', system: 'Hormones', pillars: ['Nourish', 'Move', 'Clinical'],
    detect: (c) => {
      if (c.sex !== 'female' || c.menopausal) return null
      const markers = ['Total Testosterone', 'FAI'].filter(n => c.above(n))
      if (markers.length === 0) return null
      const signals: string[] = []
      if (c.symptom(/hair_loss/)) signals.push('hair changes / hair loss')
      if (c.anthro(/adiposity|obese|waist/)) signals.push('central adiposity')
      if (c.watchOrWorse('HOMA-IR') || c.watchOrWorse('HbA1c')) signals.push('insulin resistance signals')
      return {
        biomarkers: markers, signals,
        baseSeverity: 'moderate', refer: true,
        detail: 'Testosterone or the Free Androgen Index is above the female reference range. Androgen excess in women can reflect PCOS, adrenal overactivity, or other causes — a clinical evaluation helps identify the driver.',
      }
    },
  },
  {
    id: 'low_shbg', title: 'Low SHBG', system: 'Hormones', pillars: ['Nourish', 'Move'],
    detect: (c) => {
      if (!c.below('SHBG')) return null
      const metabolic = c.watchOrWorse('HOMA-IR') || c.watchOrWorse('TG/HDL Ratio') || c.anthro(/adiposity|obese|waist/)
      const signals: string[] = []
      if (metabolic) signals.push('metabolic resistance signals')
      if (c.sex === 'female') signals.push('early insulin-driven suppression (PCOS risk)')
      const biomarkers: string[] = ['SHBG']
      if (c.above('Total Testosterone')) biomarkers.push('Total Testosterone')
      if (c.above('FAI')) biomarkers.push('FAI')
      return {
        biomarkers, signals,
        baseSeverity: metabolic ? 'moderate' : 'low',
        detail: 'SHBG is below the reference range. Low SHBG increases free hormone exposure and is an early insulin-resistance marker — particularly in women, where it can precede other PCOS features. Reducing refined carbs and increasing activity are the most evidence-backed levers.',
      }
    },
  },

  // ============================ Cross-system, questionnaire-led ============================
  {
    id: 'high_stress', title: 'Elevated perceived stress', system: 'Cross-system', pillars: ['Calm'],
    detect: (c) => {
      if (!(c.domainLow('stress') || c.domainFlag('stress', 'elevated_stress'))) return null
      const signals = ['PSS-10 stress score']
      const biomarkers = ['Morning Cortisol', 'NLR', 'hs-CRP'].filter(n => c.above(n))
      if (biomarkers.length) signals.push('biological stress markers')
      return {
        biomarkers, signals, baseSeverity: c.domainScore('stress') < 30 ? 'high' : 'moderate',
        detail: 'Perceived stress is running high, a primary target for the Calm pillar (breathwork, boundaries, recovery).',
      }
    },
  },
  {
    id: 'poor_sleep', title: 'Disrupted sleep', system: 'Cross-system', pillars: ['Calm'],
    detect: (c) => {
      if (!(c.domainLow('sleep') || c.domainFlag('sleep', 'elevated_sleep_disturbance'))) return null
      const signals = ['PROMIS sleep score']
      if (c.above('hs-CRP')) signals.push('inflammation')
      return {
        biomarkers: [], signals, baseSeverity: c.domainScore('sleep') < 30 ? 'high' : 'moderate',
        detail: 'Sleep quality is low. It amplifies stress, appetite, and inflammation, so it is often the highest-leverage place to start.',
      }
    },
  },
  {
    id: 'low_wellbeing',
    title: (c) => (c.domainFlag('wellbeing', 'depression_screen_positive') ? 'Low wellbeing, worth support' : 'Lower wellbeing'),
    system: 'Cross-system', pillars: ['Calm', 'Clinical'],
    detect: (c) => {
      const screen = c.domainFlag('wellbeing', 'depression_screen_positive')
      if (!(c.domainLow('wellbeing') || screen)) return null
      return {
        biomarkers: [], signals: ['WHO-5 wellbeing score'],
        baseSeverity: screen ? 'high' : 'moderate', refer: screen,
        detail: screen
          ? 'Your wellbeing score is low enough that talking with a professional could really help; you do not have to navigate it alone.'
          : 'Overall wellbeing is on the lower side; the Calm pillar and connection with people you trust can help lift it.',
      }
    },
  },
  {
    id: 'insufficient_activity', title: 'Below activity guidelines', system: 'Cross-system', pillars: ['Move'],
    detect: (c) => {
      if (!c.domainLow('activity')) return null
      return {
        biomarkers: [], signals: ['Exercise Vital Sign'],
        baseSeverity: c.domainScore('activity') < 30 ? 'moderate' : 'low',
        detail: 'Activity is below the recommended weekly amount; small, consistent movement is the Move pillar starting point.',
      }
    },
  },
  {
    id: 'diet_quality', title: 'Room to strengthen diet quality', system: 'Cross-system', pillars: ['Nourish'],
    detect: (c) => {
      if (!c.domainLow('nutrition')) return null
      return {
        biomarkers: [], signals: ['Starting the Conversation diet screen'],
        baseSeverity: c.domainScore('nutrition') < 30 ? 'moderate' : 'low',
        detail: 'Diet quality has clear room to improve, the foundation for most of the lab markers above.',
      }
    },
  },
  {
    id: 'risky_alcohol', title: 'Higher-risk alcohol use', system: 'Cross-system', pillars: ['Calm', 'Clinical'],
    detect: (c) => {
      if (!c.alcoholRisk) return null
      const signals = ['AUDIT-C screen']
      const biomarkers: string[] = []
      if (c.above('GGT')) { biomarkers.push('GGT'); signals.push('raised GGT') }
      return {
        biomarkers, signals, baseSeverity: c.above('GGT') ? 'high' : 'moderate',
        detail: 'Alcohol intake screens in the higher-risk range'
          + (c.above('GGT') ? ', and GGT is raised in keeping with that.' : '. Cutting back is one of the highest-impact changes available.'),
      }
    },
  },

  // ============================ Discordances & confounders (avenue B) ============================
  {
    id: 'apob_ldl_discordance', title: 'Particle count higher than LDL suggests', system: 'Heart',
    pillars: ['Nourish', 'Move'],
    detect: (c) => {
      // ApoB elevated while LDL looks acceptable: particle burden underestimated by LDL.
      if (!c.watchOrWorse('ApoB')) return null
      if (c.above('LDL')) return null // overt high LDL is handled by dyslipidemia
      const signals: string[] = []
      if (c.familyHistory(/cardio|heart|cholesterol|stroke/)) signals.push('family history of heart disease')
      if (c.anthro(/adiposity|obese|waist/)) signals.push('central adiposity')
      return {
        biomarkers: ['ApoB', 'LDL', ...(c.above('Remnant Cholesterol') ? ['Remnant Cholesterol'] : [])],
        signals, baseSeverity: 'moderate',
        detail: 'Your LDL reads acceptable, but ApoB (the count of atherogenic particles) is higher than that — and ApoB tracks cardiovascular risk more closely, so this is the more reliable signal.',
      }
    },
  },
  {
    id: 'iron_status_confounded', title: 'Iron reading clouded by inflammation', system: 'Blood & immune',
    pillars: ['Clinical'],
    detect: (c) => {
      // Inflammation present and ferritin NOT low → ferritin may be falsely reassuring.
      const inflamed = c.above('hs-CRP') || c.above('ESR')
      if (!inflamed || c.below('Ferritin')) return null
      // Only meaningful if there is a reason to care about iron (low-ish transferrin sat or fatigue).
      if (!(c.below('Transferrin Saturation') || c.domainLow('activity') || c.symptom(/hair_loss|motivation|afternoon/))) return null
      return {
        biomarkers: ['Ferritin', c.above('hs-CRP') ? 'hs-CRP' : 'ESR', ...(c.below('Transferrin Saturation') ? ['Transferrin Saturation'] : [])],
        signals: ['inflammation present'], baseSeverity: 'low',
        detail: 'Ferritin rises with inflammation, so a normal-looking ferritin here may overstate your true iron stores — transferrin saturation is the better guide while inflammation is active.',
      }
    },
  },
  {
    id: 'calcium_albumin_correction', title: 'Calcium shifts once albumin is accounted for', system: 'Kidney',
    pillars: ['Clinical'],
    detect: (c) => {
      const raw = c.tier('Calcium'), corr = c.tier('Corrected Calcium')
      if (corr === 'unknown' || raw === 'unknown') return null
      const rawAbn = raw === 'out_of_range' || raw === 'critical'
      const corrAbn = corr === 'out_of_range' || corr === 'critical'
      if (rawAbn === corrAbn) return null // no meaningful change
      return {
        biomarkers: ['Calcium', 'Corrected Calcium', 'Albumin'],
        signals: [], baseSeverity: corrAbn ? 'moderate' : 'low',
        refer: corrAbn,
        detail: corrAbn
          ? 'Measured calcium looks normal, but once corrected for your albumin it falls outside range — the corrected value is the one to act on.'
          : 'Measured calcium looks abnormal, but it corrects to normal once your albumin level is taken into account, so it is likely fine.',
      }
    },
  },
  {
    id: 'mcv_rdw_early_deficiency', title: 'Early red-cell size variation', system: 'Blood & immune',
    pillars: ['Nourish'],
    detect: (c) => {
      // RDW high but MCV still normal and not anaemic: anisocytosis can precede frank deficiency/anaemia.
      if (!(c.above('RDW') && !c.below('MCV') && !c.above('MCV') && !c.below('Haemoglobin'))) return null
      return {
        biomarkers: ['RDW', 'MCV'], signals: lowEnergy(c) ? ['low energy'] : [],
        baseSeverity: 'low',
        detail: 'Your red cells vary more in size than usual (high RDW) even though their average size and your haemoglobin are still normal — this can be an early sign of an iron, B12, or folate gap before anaemia appears.',
      }
    },
  },

  // ============================ Branching algorithms (avenue C) ============================
  {
    id: 'thalassemia_trait_possible', title: 'Microcytosis with normal iron', system: 'Blood & immune',
    pillars: ['Clinical'],
    detect: (c) => {
      if (!(c.below('MCV') && !c.below('Ferritin') && !c.below('Transferrin Saturation') && !c.above('RDW'))) return null
      return {
        biomarkers: ['MCV', ...(c.below('Haemoglobin') ? ['Haemoglobin'] : []), ...(c.tier('Ferritin') !== 'unknown' ? ['Ferritin'] : [])],
        signals: [], baseSeverity: 'moderate', refer: true,
        detail: 'Small red cells with normal iron stores and uniform cell size point away from iron deficiency and toward an inherited trait such as thalassaemia — a haemoglobin study can confirm it.',
      }
    },
  },
  {
    id: 'normocytic_anemia', title: 'Normocytic anaemia', system: 'Blood & immune', pillars: ['Clinical'],
    detect: (c) => {
      if (!(c.below('Haemoglobin') && !c.below('MCV') && !c.above('MCV'))) return null
      if (c.above('hs-CRP') || c.above('ESR')) return null // handled by anemia_inflammatory
      const retic = c.value('Reticulocyte')
      const highRetic = retic !== null && retic > 2.5
      return {
        biomarkers: ['Haemoglobin', ...(retic !== null ? ['Reticulocyte'] : [])],
        signals: lowEnergy(c) ? ['low energy'] : [],
        baseSeverity: 'high', refer: true,
        detail: highRetic
          ? 'Anaemia with a high reticulocyte count suggests the marrow is responding to blood loss or red-cell breakdown — the source is worth finding.'
          : 'Anaemia with normal-sized cells and a low/normal reticulocyte response suggests under-production (chronic disease, early deficiency, or marrow causes) and is worth a clinical work-up.',
      }
    },
  },
  {
    id: 'macrocytic_nondeficiency', title: 'Enlarged red cells (non-deficiency)', system: 'Blood & immune',
    pillars: ['Clinical', 'Calm'],
    detect: (c) => {
      if (!(c.above('MCV') && !c.watchOrWorse('Vitamin B12') && !c.below('Folate (B9)'))) return null
      const signals: string[] = []
      if (c.alcoholRisk) signals.push('higher-risk alcohol use')
      if (c.above('TSH')) signals.push('underactive thyroid')
      return {
        biomarkers: ['MCV', ...(c.below('Haemoglobin') ? ['Haemoglobin'] : [])], signals,
        baseSeverity: c.below('Haemoglobin') ? 'moderate' : 'low',
        detail: 'Red cells are enlarged but B12 and folate are adequate — common contributors are alcohol, an underactive thyroid, or increased red-cell turnover; worth interpreting in context.',
      }
    },
  },
  {
    id: 'subclinical_hyperthyroid', title: 'Subclinical hyperthyroid pattern', system: 'Thyroid', pillars: ['Clinical'],
    detect: (c) => {
      if (!(c.below('TSH') && !c.above('FT4') && !c.above('FT3'))) return null
      return {
        biomarkers: ['TSH'], signals: [], baseSeverity: 'moderate',
        detail: 'TSH is low while thyroid hormones remain in range (a subclinical pattern); usually monitored and re-checked rather than treated immediately.',
        managedNote: c.condition(/thyroid/) ? 'You have noted a thyroid condition; share this with your clinician.' : undefined,
      }
    },
  },
  {
    id: 'cholestatic_pattern', title: 'Cholestatic liver pattern', system: 'Liver', pillars: ['Clinical'],
    detect: (c) => {
      if (!(c.above('ALP') && (c.above('GGT') || c.above('Bilirubin')))) return null
      return {
        biomarkers: ['ALP', ...['GGT', 'Bilirubin'].filter(n => c.above(n))],
        signals: [], baseSeverity: 'high', refer: true,
        detail: 'A rise in ALP together with GGT/bilirubin points to a cholestatic (bile-flow) pattern rather than direct liver-cell injury — best assessed by a clinician.',
      }
    },
  },

  // ============================ Confounder awareness (avenue D) ============================
  {
    id: 'dehydration_pattern', title: 'Possible dehydration effect', system: 'Kidney', pillars: ['Clinical'],
    detect: (c) => {
      const ratio = c.value('BUN/Creatinine Ratio')
      if (!((ratio !== null && ratio > 20) || c.above('BUN/Creatinine Ratio'))) return null
      const conc = ['Haemoglobin', 'Albumin', 'Sodium'].filter(n => c.above(n))
      return {
        biomarkers: ['BUN/Creatinine Ratio', ...conc], signals: [], baseSeverity: 'low',
        detail: 'A high urea-to-creatinine ratio suggests a pre-renal/dehydration picture rather than intrinsic kidney disease; some other values may read slightly concentrated. Re-testing well-hydrated can clarify.',
      }
    },
  },
  {
    id: 'recent_illness_confounder', title: 'Recent illness may be skewing results', system: 'Blood & immune',
    pillars: ['Clinical'],
    detect: (c) => {
      if (!c.symptom(/illness/)) return null
      if (!(c.above('hs-CRP') || c.above('ESR') || c.above('White Blood Cells'))) return null
      return {
        biomarkers: ['hs-CRP', 'ESR', 'White Blood Cells'].filter(n => c.above(n)), signals: ['recent illness reported'],
        baseSeverity: 'low',
        detail: 'You reported a recent illness, which can transiently raise inflammatory and white-cell markers; re-testing once fully recovered gives a truer baseline.',
      }
    },
  },
  {
    id: 'statin_ldl_control', title: 'LDL still raised on therapy', system: 'Heart', pillars: ['Clinical'],
    detect: (c) => {
      if (!c.medication(/statin|atorvastatin|rosuvastatin|simvastatin|ezetimibe/)) return null
      if (!(c.above('LDL') || c.watchOrWorse('ApoB'))) return null
      return {
        biomarkers: ['LDL', ...(c.watchOrWorse('ApoB') ? ['ApoB'] : [])], signals: ['on lipid-lowering medication'],
        baseSeverity: 'high', refer: true,
        detail: 'You appear to be on lipid-lowering medication, yet LDL/ApoB remain above target — worth reviewing adherence, dose, or add-on therapy with your clinician.',
      }
    },
  },

  // ============================ Risk frameworks (avenue E) ============================
  {
    id: 'cardiometabolic_risk', title: 'Elevated cardiometabolic risk', system: 'Heart', pillars: ['Nourish', 'Move', 'Clinical'],
    detect: (c) => {
      const factors: string[] = []
      if (c.above('Lp(a)')) factors.push('raised Lp(a)')
      if (c.watchOrWorse('ApoB')) factors.push('raised ApoB')
      if (c.smoker) factors.push('smoking')
      if (c.anthro(/adiposity|obese|waist/)) factors.push('central adiposity')
      if (c.familyHistory(/cardio|heart|stroke/)) factors.push('family history')
      if (c.age !== null && c.age >= 55) factors.push('age')
      if (factors.length < 2) return null
      return {
        biomarkers: ['Lp(a)', 'ApoB'].filter(n => c.watchOrWorse(n)), signals: factors,
        baseSeverity: factors.length >= 3 ? 'high' : 'moderate',
        priorityBoost: c.above('Lp(a)') ? 8 : 0,
        detail: `Several cardiovascular risk factors cluster here (${factors.join(', ')}). Individually modest, together they meaningfully raise long-term risk — a focus for the Move and Nourish pillars and a conversation with your clinician.`,
      }
    },
  },
  {
    id: 'diabetes_risk', title: 'Elevated future diabetes risk', system: 'Metabolic', pillars: ['Nourish', 'Move'],
    detect: (c) => {
      if (c.watchOrWorse('HbA1c') || c.watchOrWorse('Fasting Glucose') || c.watchOrWorse('HOMA-IR')) return null
      const factors: string[] = []
      if (c.anthro(/adiposity|obese|waist/)) factors.push('central adiposity')
      if (c.familyHistory(/diabet/)) factors.push('family history of diabetes')
      if (c.domainLow('activity')) factors.push('low activity')
      if (c.age !== null && c.age >= 45) factors.push('age')
      if (factors.length < 2) return null
      return {
        biomarkers: [], signals: factors,
        baseSeverity: factors.length >= 3 ? 'moderate' : 'low',
        detail: `Your glucose markers are currently healthy, but several factors raise future diabetes risk (${factors.join(', ')}). This is the most preventable window — movement, diet, and weight have the biggest effect now.`,
      }
    },
  },

  // ============================ Composites (avenue F) ============================
  {
    id: 'multi_nutrient_gap', title: 'Multiple micronutrient gaps', system: 'Vitamins', pillars: ['Nourish', 'Clinical'],
    detect: (c) => {
      const gaps: string[] = []
      if (c.below('Vitamin D (25-OH)')) gaps.push('Vitamin D (25-OH)')
      if (c.watchOrWorse('Vitamin B12')) gaps.push('Vitamin B12')
      if (c.below('Folate (B9)')) gaps.push('Folate (B9)')
      if (c.below('Magnesium')) gaps.push('Magnesium')
      if (c.below('Ferritin') || c.below('Transferrin Saturation')) gaps.push('iron')
      if (gaps.length < 3) return null
      const signals: string[] = []
      if (c.diet(/vegan|vegetarian/)) signals.push('plant-based diet')
      if (lowEnergy(c)) signals.push('low energy')
      return {
        biomarkers: gaps.filter(g => g !== 'iron'), signals, baseSeverity: 'moderate',
        detail: `Several micronutrients are low at once (${gaps.join(', ')}). When multiple gaps appear together, it is worth looking past intake to absorption (gut health, coeliac, medication) rather than treating each in isolation.`,
      }
    },
  },

  // ============================ Physiologic state (avenue G) ============================
  {
    id: 'pcos_suggestive', title: 'PCOS-suggestive pattern', system: 'Hormones', pillars: ['Nourish', 'Move', 'Clinical'],
    detect: (c) => {
      if (c.sex !== 'female' || c.menopausal) return null
      const ratio = c.value('LH/FSH Ratio')
      const lhFshHigh = (ratio !== null && ratio > 2) || c.above('LH/FSH Ratio')
      const metabolic = c.watchOrWorse('HOMA-IR') || c.watchOrWorse('HbA1c') || c.anthro(/adiposity|obese|waist/)
      if (!(lhFshHigh && metabolic)) return null
      const signals: string[] = []
      if (c.symptom(/hair_loss/)) signals.push('hair changes')
      if (c.anthro(/adiposity|obese|waist/)) signals.push('central adiposity')
      if (c.above('Total Testosterone') || c.above('FAI')) signals.push('androgen excess markers')
      const pcBiomarkers: string[] = ['LH/FSH Ratio', ...['HOMA-IR', 'HbA1c'].filter(n => c.watchOrWorse(n))]
      if (c.above('Total Testosterone')) pcBiomarkers.push('Total Testosterone')
      if (c.above('FAI')) pcBiomarkers.push('FAI')
      return {
        biomarkers: pcBiomarkers, signals,
        baseSeverity: 'moderate', refer: true,
        detail: 'An LH:FSH ratio above 2 alongside insulin-resistance signals can point toward PCOS. Cycle timing strongly affects these hormones, so this is a prompt to discuss with a clinician, not a diagnosis.',
      }
    },
  },
  {
    id: 'menopausal_transition', title: 'Consistent with menopausal transition', system: 'Hormones', pillars: ['Calm', 'Clinical'],
    detect: (c) => {
      if (c.sex !== 'female') return null
      const fsh = c.value('FSH (women)')
      const fshHigh = fsh !== null && fsh > 25
      if (!(fshHigh && (c.below('Estradiol (women)') || (c.age !== null && c.age >= 45)))) return null
      return {
        biomarkers: ['FSH (women)', ...(c.below('Estradiol (women)') ? ['Estradiol (women)'] : [])], signals: [], baseSeverity: 'low',
        detail: 'A raised FSH with lower estradiol around this age is consistent with the menopausal transition — a normal life stage worth knowing, as it shifts cardiovascular and bone priorities going forward.',
      }
    },
  },

  // ============================ Strengths (what is going well) ============================
  {
    id: 'metabolic_strength', title: 'Strong metabolic health', system: 'Metabolic', pillars: ['Nourish', 'Move'], kind: 'strength',
    detect: (c) => {
      const good = ['HbA1c', 'HOMA-IR', 'Fasting Glucose', 'TG/HDL Ratio'].filter(n => c.tier(n) === 'optimal')
      const watchCount = ['HOMA-IR', 'HbA1c', 'Fasting Glucose', 'TG/HDL Ratio', 'Triglycerides', 'Fatty Liver Index'].filter(n => c.watchOrWorse(n)).length
      // Fire only when genuinely strong AND the insulin-resistance rule will not fire (mutually exclusive).
      if (good.length < 2 || c.tier('HbA1c') !== 'optimal' || watchCount >= 2 || c.anthro(/adiposity|obese|waist/)) return null
      return { biomarkers: good, signals: [], baseSeverity: 'info', detail: 'Blood sugar and insulin-sensitivity markers are in an excellent range. Keep doing what you are doing.' }
    },
  },
  {
    id: 'cardiovascular_strength', title: 'Healthy cardiovascular markers', system: 'Heart', pillars: ['Nourish', 'Move'], kind: 'strength',
    detect: (c) => {
      const good = ['LDL', 'ApoB', 'Non-HDL', 'hs-CRP'].filter(n => c.tier(n) === 'optimal')
      const hdlOk = c.tier('HDL') === 'optimal' || c.tier('HDL') === 'normal'
      if (good.length < 2 || c.abnormal('LDL') || c.above('hs-CRP') || !hdlOk) return null
      return { biomarkers: good, signals: [], baseSeverity: 'info', detail: 'Your lipid and inflammation markers are in a low cardiovascular-risk range.' }
    },
  },
  {
    id: 'robust_micronutrients', title: 'Solid micronutrient status', system: 'Vitamins', pillars: ['Nourish'], kind: 'strength',
    detect: (c) => {
      const good = ['Vitamin D (25-OH)', 'Vitamin B12', 'Ferritin'].filter(n => c.tier(n) === 'optimal' || c.tier(n) === 'normal')
      const anyLow = c.below('Vitamin D (25-OH)') || c.watchOrWorse('Vitamin B12') || c.below('Ferritin')
      if (good.length < 2 || anyLow) return null
      return { biomarkers: good, signals: [], baseSeverity: 'info', detail: 'Key vitamins and iron stores are in a healthy range, a good foundation for energy and cognition.' }
    },
  },
  {
    id: 'active_lifestyle', title: 'Meeting activity guidelines', system: 'Cross-system', pillars: ['Move'], kind: 'strength',
    detect: (c) => {
      if (c.domainScore('activity') < 75) return null
      return { biomarkers: [], signals: ['Exercise Vital Sign'], baseSeverity: 'info', detail: 'You are meeting or exceeding the recommended weekly activity, including strength work. This protects nearly every system above.' }
    },
  },
  {
    id: 'restorative_sleep', title: 'Restorative sleep', system: 'Cross-system', pillars: ['Calm'], kind: 'strength',
    detect: (c) => {
      if (c.domainScore('sleep') < 75) return null
      return { biomarkers: [], signals: ['PROMIS sleep score'], baseSeverity: 'info', detail: 'Sleep quality is strong, which supports stress resilience, metabolism, and recovery.' }
    },
  },
  {
    id: 'strong_resilience', title: 'Good stress resilience', system: 'Cross-system', pillars: ['Calm'], kind: 'strength',
    detect: (c) => {
      if (c.domainScore('stress') < 70 || c.domainScore('wellbeing') < 60) return null
      return { biomarkers: [], signals: ['PSS-10', 'WHO-5'], baseSeverity: 'info', detail: 'Perceived stress is low and wellbeing is healthy, a strong base to build the rest of the plan on.' }
    },
  },
]

// ── finding-linking ─────────────────────────────────────────────────────
// When BOTH findings in a link are present, the engine attaches `note` to the `target` finding,
// referencing the `source`. This is what makes the report read as connected reasoning rather than a
// list. Links are one-directional (source provides context to target) and only fire when both exist.
export interface LinkRule { source: string; target: string; relation: string; note: string }

export const FINDING_LINKS: LinkRule[] = [
  { source: 'inflammation', target: 'iron_deficiency', relation: 'confounds',
    note: 'Active inflammation can inflate ferritin, so your iron stores may be lower than the number suggests.' },
  { source: 'inflammation', target: 'iron_status_confounded', relation: 'explains',
    note: 'This is the same inflammation signal flagged above.' },
  { source: 'metabolic_syndrome', target: 'insulin_resistance', relation: 'includes',
    note: 'Part of the broader metabolic-syndrome pattern.' },
  { source: 'metabolic_syndrome', target: 'dyslipidemia', relation: 'includes',
    note: 'Part of the broader metabolic-syndrome pattern.' },
  { source: 'metabolic_syndrome', target: 'liver_fibrosis_risk', relation: 'contributes_to',
    note: 'Metabolic load is a leading driver of fatty-liver change and fibrosis risk.' },
  { source: 'insulin_resistance', target: 'liver_fibrosis_risk', relation: 'contributes_to',
    note: 'Insulin resistance is a primary driver of fatty-liver disease.' },
  { source: 'thyroid_hypo', target: 'dyslipidemia', relation: 'contributes_to',
    note: 'An underactive thyroid can raise cholesterol; treating it may improve these numbers.' },
  { source: 'apob_ldl_discordance', target: 'dyslipidemia', relation: 'refines',
    note: 'ApoB indicates the true particle burden behind these lipid numbers.' },
  { source: 'dyslipidemia', target: 'apob_ldl_discordance', relation: 'refines',
    note: 'See the lipid finding for the related cholesterol values.' },
  { source: 'risky_alcohol', target: 'liver_stress', relation: 'contributes_to',
    note: 'Alcohol intake is a likely contributor to these liver markers.' },
  { source: 'risky_alcohol', target: 'alcohol_liver_ratio', relation: 'contributes_to',
    note: 'Consistent with the higher-risk drinking flagged in your questionnaire.' },
  { source: 'high_stress', target: 'inflammation', relation: 'contributes_to',
    note: 'Chronic stress is one plausible contributor to a raised inflammatory signal.' },
  { source: 'poor_sleep', target: 'insulin_resistance', relation: 'contributes_to',
    note: 'Short or poor sleep worsens insulin sensitivity and appetite regulation.' },
  { source: 'inflammation', target: 'normocytic_anemia', relation: 'may_explain',
    note: 'Ongoing inflammation is a common cause of normocytic anaemia (anaemia of chronic disease).' },
  { source: 'risky_alcohol', target: 'macrocytic_nondeficiency', relation: 'may_explain',
    note: 'Alcohol is a frequent cause of enlarged red cells when B12 and folate are normal.' },
  { source: 'thyroid_hypo', target: 'macrocytic_nondeficiency', relation: 'may_explain',
    note: 'An underactive thyroid can enlarge red cells.' },
  { source: 'metabolic_syndrome', target: 'cardiometabolic_risk', relation: 'reinforces',
    note: 'The metabolic-syndrome cluster compounds the cardiovascular risk factors here.' },
  { source: 'cardiometabolic_risk', target: 'dyslipidemia', relation: 'frames',
    note: 'These lipids sit within a broader elevated cardiovascular risk profile.' },
  { source: 'dehydration_pattern', target: 'kidney_function', relation: 'may_explain',
    note: 'A dehydration effect can raise kidney markers without intrinsic disease — re-test hydrated.' },
  { source: 'recent_illness_confounder', target: 'inflammation', relation: 'confounds',
    note: 'A recent illness may be transiently driving this inflammatory signal.' },
  { source: 'menopausal_transition', target: 'cardiometabolic_risk', relation: 'frames',
    note: 'Cardiovascular risk rises through the menopausal transition.' },
  { source: 'multi_nutrient_gap', target: 'iron_deficiency', relation: 'includes',
    note: 'Part of a broader multi-nutrient gap — consider absorption, not just intake.' },
  { source: 'multi_nutrient_gap', target: 'vitamin_d_low', relation: 'includes',
    note: 'Part of a broader multi-nutrient gap — consider absorption, not just intake.' },
  { source: 'multi_nutrient_gap', target: 'b12_folate_low', relation: 'includes',
    note: 'Part of a broader multi-nutrient gap — consider absorption, not just intake.' },
]
