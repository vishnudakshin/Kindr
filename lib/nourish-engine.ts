// lib/nourish-engine.ts
//
// Personalized Nourish task generator. Fuses lab biomarker values, diet log,
// STC/AUDIT-C questionnaire scores, symptom flags, and profile signals into
// concrete, value-referenced daily food tasks. Called by the intervention engine
// when lab or diet data is available; falls back to the existing INTERVENTION_MAP
// when neither is present.

import type {
  DietLog, NutritionResponses, HistoryResponses, SymptomsResponses, ActivityResponses,
  MacroNutrients,
} from './types'
import type { LabInterpretation, BiomarkerTier } from './lab-interpretation'
import type { SafetyFlag, DietaryRequirement, Phase, PlannedTask } from './intervention-schema'
import {
  mealKcal, estimateDietCalories, computeTDEE,
  estimateDietMacros, computeMacroTargets, type MacroTargets,
} from './nutrition-table'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Lab snapshot helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface LabVal { value: number | null; tier: BiomarkerTier }
const UNKNOWN_LAB: LabVal = { value: null, tier: 'unknown' }

export function labVal(lab: LabInterpretation, name: string): LabVal {
  const b = lab.biomarkers.find(m => m.name === name)
  if (!b || b.tier === 'unknown') return UNKNOWN_LAB
  const v = typeof b.value === 'number' ? b.value : null
  return { value: v, tier: b.tier }
}

const WATCH_PLUS: BiomarkerTier[] = ['watch', 'out_of_range', 'critical']
const OUT_PLUS: BiomarkerTier[] = ['out_of_range', 'critical']

export function isWatch(tier: BiomarkerTier) { return WATCH_PLUS.includes(tier) }
export function isOut(tier: BiomarkerTier)   { return OUT_PLUS.includes(tier) }

export function fmt(v: number | null, dp = 1): string {
  return v !== null ? v.toFixed(dp) : '?'
}

function tierLabel(tier: BiomarkerTier): string {
  if (tier === 'out_of_range' || tier === 'critical') return 'out of range'
  if (tier === 'watch') return 'borderline'
  return ''
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. STC + AUDIT-C
// ─────────────────────────────────────────────────────────────────────────────

interface StcCtx {
  breakfastFreq: number  // stc[0]: 0=Daily 1=Most days 2=Rarely/never
  fruitVeg:      number  // stc[1]: 0=Daily 1=Sometimes 2=Rarely/never
  wholeGrains:   number  // stc[2]: 0=Daily 1=Sometimes 2=Rarely/never
  processedFood: number  // stc[3]: 0=Rarely/never 1=Sometimes 2=Often/daily
  sugaryDrinks:  number  // stc[5]: 0=Rarely/never 1=Sometimes 2=Daily
}

function extractStc(n: NutritionResponses): StcCtx {
  const s = n.stc
  return {
    breakfastFreq: s[0] ?? 0,
    fruitVeg:      s[1] ?? 0,
    wholeGrains:   s[2] ?? 0,
    processedFood: s[3] ?? 0,
    sugaryDrinks:  s[5] ?? 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Diet log analysis
// ─────────────────────────────────────────────────────────────────────────────

const PROTEIN_IDS = new Set([
  'egg_boiled','omelette','chicken_curry','fish_curry','egg_curry','mutton_curry',
  'paneer_dish','dal','rajma_chole','sprouted_moong','pesarattu','curd_raita','protein_shake',
])
const IRON_IDS    = new Set(['dal','rajma_chole','sprouted_moong','egg_boiled','omelette','egg_curry','fish_curry','chicken_curry','mutton_curry'])
const VEG_IDS     = new Set(['salad','vegetable_sabzi','sambar'])
const LEGUME_IDS  = new Set(['dal','rajma_chole','sprouted_moong'])
const OMEGA3_IDS  = new Set(['fish_curry','egg_boiled','omelette','egg_curry'])
const TEA_IDS     = new Set(['chai','coffee_milk','black_tea_coffee'])
const SUGARY_IDS  = new Set(['soft_drink','fresh_juice','lassi_sweet'])
const B12_IDS     = new Set(['egg_boiled','omelette','egg_curry','milk_plain','curd_raita','chicken_curry','fish_curry','mutton_curry'])
const VITD_IDS    = new Set(['egg_boiled','omelette','egg_curry','milk_plain','fish_curry'])
const WHOLEGRAIN_IDS = new Set(['oats','khichdi'])
const HIGH_KCAL_SNACKS = new Map([
  ['samosa_bajji', 'samosa/bajji'],
  ['banana_chips', 'banana chips'],
  ['murukku',      'murukku'],
])

export interface DietCtx {
  logged: number
  tdee: number | null
  beverageKcal: number
  presentFoodIds: Set<string>
  breakfastEmpty: boolean
  breakfastHasProtein: boolean
  breakfastTotalKcal: number
  missingProtein: boolean
  missingLegumes: boolean
  missingLeafyVeg: boolean
  missingFruit: boolean
  missingOmega3: boolean
  missingIronFood: boolean
  missingWholeGrain: boolean
  missingB12Food: boolean
  missingVitDFood: boolean
  hasTea: boolean
  ironFoodWithTea: boolean
  hasGhee: boolean
  hasHighKcalSnack: boolean
  highKcalSnackName: string | null
  hasSugaryDrink: boolean
  // Macronutrient context
  macros: MacroNutrients
  macroTargets: MacroTargets | null
  lowProtein: boolean        // protein < 60% of weight-based target
  lowFiber: boolean          // fiber < 50% of DRI target
  refinedCarbPattern: boolean // high carb (>180g) with very low fiber (<12g)
}

function analyzeDietLog(
  log: DietLog,
  history: HistoryResponses,
  activity: ActivityResponses,
): DietCtx {
  const allSlots = [log.breakfast, log.midMorning, log.lunch, log.evening, log.dinner, log.beverages]
  const allIds = new Set<string>()
  for (const slot of allSlots) for (const id of Object.keys(slot.selections)) allIds.add(id)

  const breakfastIds = new Set(Object.keys(log.breakfast.selections))
  const breakfastEmpty = breakfastIds.size === 0 && !log.breakfast.freeText.trim()
  const breakfastHasProtein = [...breakfastIds].some(id => PROTEIN_IDS.has(id))

  const bevIds = new Set(Object.keys(log.beverages.selections))
  const beverageKcal = mealKcal(log.beverages)
  const hasTea = [...bevIds].some(id => TEA_IDS.has(id))
  const hasSugaryDrink = [...bevIds].some(id => SUGARY_IDS.has(id))
  const ironFoodWithTea = hasTea && [...allIds].some(id => IRON_IDS.has(id))

  let hasHighKcalSnack = false
  let highKcalSnackName: string | null = null
  for (const [id, name] of HIGH_KCAL_SNACKS) {
    if (log.evening.selections[id] || log.midMorning.selections[id]) {
      hasHighKcalSnack = true
      highKcalSnackName = name
      break
    }
  }

  const macros       = estimateDietMacros(log)
  const macroTargets = computeMacroTargets(history, activity)

  return {
    logged: estimateDietCalories(log),
    tdee: computeTDEE(history, activity),
    beverageKcal,
    presentFoodIds: allIds,
    breakfastEmpty,
    breakfastHasProtein,
    breakfastTotalKcal: mealKcal(log.breakfast),
    missingProtein:    ![...allIds].some(id => PROTEIN_IDS.has(id)),
    missingLegumes:    ![...allIds].some(id => LEGUME_IDS.has(id)),
    missingLeafyVeg:   ![...allIds].some(id => VEG_IDS.has(id)),
    missingFruit:      !allIds.has('fruit'),
    missingOmega3:     ![...allIds].some(id => OMEGA3_IDS.has(id)),
    missingIronFood:   ![...allIds].some(id => IRON_IDS.has(id)),
    missingWholeGrain: ![...allIds].some(id => WHOLEGRAIN_IDS.has(id)),
    missingB12Food:    ![...allIds].some(id => B12_IDS.has(id)),
    missingVitDFood:   ![...allIds].some(id => VITD_IDS.has(id)),
    hasTea,
    ironFoodWithTea,
    hasGhee: allIds.has('ghee_oil'),
    hasHighKcalSnack,
    highKcalSnackName,
    hasSugaryDrink,
    macros,
    macroTargets,
    lowProtein: macroTargets !== null && macros.protein_g < macroTargets.protein_g * 0.6,
    lowFiber:   macroTargets !== null && macros.fiber_g   < macroTargets.fiber_g   * 0.5,
    refinedCarbPattern: macros.carb_g > 180 && macros.fiber_g < 12,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Profile signals
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfileCtx {
  bloating: boolean
  hairLoss: boolean
  skinIssues: boolean
  headaches: boolean
  afternoonCrashes: boolean
  pcos: boolean
  ibs: boolean
  hypothyroidism: boolean
  diabetes: boolean
  familyCardio: boolean
  familyDiabetes: boolean
  familyCancer: boolean
  metformin: boolean
  anticoagulant: boolean
  antacid: boolean
  bowelStatus: HistoryResponses['bowelStatus']
  age: number | null
  isVegetarian: boolean
  isVegan: boolean
}

function extractProfile(
  history: HistoryResponses,
  symptoms: SymptomsResponses,
): ProfileCtx {
  const all = [
    ...symptoms.physical.map(s => s.toLowerCase()),
    ...symptoms.energyMood.map(s => s.toLowerCase()),
    symptoms.otherSymptoms.toLowerCase(),
  ]
  const cond = [...(history.conditions ?? []), history.conditionsOther ?? ''].join(' ').toLowerCase()
  const fam  = [...(history.familyHistory ?? []), history.familyHistoryOther ?? ''].join(' ').toLowerCase()
  const med  = [history.medications ?? '', history.medicationsText ?? ''].join(' ').toLowerCase()
  const diet = (history.dietaryPreferences ?? []).join(' ').toLowerCase()

  return {
    bloating:         all.some(s => s.includes('bloat')),
    hairLoss:         all.some(s => s.includes('hair')),
    skinIssues:       all.some(s => s.includes('skin')),
    headaches:        all.some(s => s.includes('head')),
    afternoonCrashes: all.some(s => s.includes('afternoon') || s.includes('crash')),
    pcos:             /pcos/.test(cond),
    ibs:              /ibs|ibd|irritable/.test(cond),
    hypothyroidism:   /hypothyroid/.test(cond),
    diabetes:         /type.?2.diabet|diabetes/.test(cond),
    familyCardio:     /cardiovascular|heart.disease|stroke|coronary/.test(fam),
    familyDiabetes:   /diabetes|type.?2/.test(fam),
    familyCancer:     /cancer/.test(fam),
    metformin:        /metformin|glucophage/.test(med),
    anticoagulant:    /warfarin|coumadin|xarelto|apixaban|dabigatran|rivaroxaban|eliquis/.test(med),
    antacid:          /omeprazole|pantoprazole|rabeprazole|lansoprazole|ranitidine|famotidine|antacid/.test(med),
    bowelStatus:      history.bowelStatus,
    age:              history.age,
    isVegetarian:     /vegetarian|vegan/.test(diet),
    isVegan:          /vegan/.test(diet),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. NourishContext
// ─────────────────────────────────────────────────────────────────────────────

export interface NourishContext {
  lab: {
    ferritin: LabVal; vitaminD: LabVal; homaIR: LabVal; glucose: LabVal; hba1c: LabVal
    nonHDL: LabVal; ldl: LabVal; tg: LabVal; hsCRP: LabVal; b12: LabVal
    fli: LabVal; alt: LabVal; ggt: LabVal
  }
  stc: StcCtx
  alcohol: { riskFlag: boolean; frequencyScore: number; quantityScore: number; raw: number }
  diet: DietCtx | null
  profile: ProfileCtx
  safetyFlags: Set<SafetyFlag>
  dietaryExclusions: Set<DietaryRequirement>
}

export function buildNourishContext(
  labInterp: LabInterpretation,
  history: HistoryResponses,
  nutrition: NutritionResponses,
  symptoms: SymptomsResponses,
  activity: ActivityResponses,
  dietLog: DietLog | null,
  safetyFlags: SafetyFlag[],
  dietaryExclusions: DietaryRequirement[],
): NourishContext {
  const isFemale = /female|woman/i.test(history.sex)
  const auditRaw = nutrition.auditC.reduce((a, v) => a + v, 0)
  const auditThreshold = isFemale ? 3 : 4

  return {
    lab: {
      ferritin:  labVal(labInterp, 'Ferritin'),
      vitaminD:  labVal(labInterp, 'Vitamin D (25-OH)'),
      homaIR:    labVal(labInterp, 'HOMA-IR'),
      glucose:   labVal(labInterp, 'Fasting Glucose'),
      hba1c:     labVal(labInterp, 'HbA1c'),
      nonHDL:    labVal(labInterp, 'Non-HDL'),
      ldl:       labVal(labInterp, 'LDL'),
      tg:        labVal(labInterp, 'Triglycerides'),
      hsCRP:     labVal(labInterp, 'hs-CRP'),
      b12:       labVal(labInterp, 'Vitamin B12'),
      fli:       labVal(labInterp, 'Fatty Liver Index'),
      alt:       labVal(labInterp, 'ALT'),
      ggt:       labVal(labInterp, 'GGT'),
    },
    stc: extractStc(nutrition),
    alcohol: {
      riskFlag:       auditRaw >= auditThreshold,
      frequencyScore: nutrition.auditC[0] ?? 0,
      quantityScore:  nutrition.auditC[1] ?? 0,
      raw:            auditRaw,
    },
    diet: dietLog ? analyzeDietLog(dietLog, history, activity) : null,
    profile: extractProfile(history, symptoms),
    safetyFlags: new Set(safetyFlags),
    dietaryExclusions: new Set(dietaryExclusions),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Rule definitions
// ─────────────────────────────────────────────────────────────────────────────

type TaskBase = Omit<PlannedTask, 'isKeystone'>

interface NourishRule {
  priority: number
  id: string
  check: (ctx: NourishContext) => boolean
  build: (ctx: NourishContext) => TaskBase
}

const RULES: NourishRule[] = [

  // ── P1: out_of_range lab + diet gap confirms it ─────────────────────────

  {
    priority: 10, id: 'nr_pers_iron_out_gap',
    check: ctx =>
      isOut(ctx.lab.ferritin.tier) &&
      (ctx.diet?.missingIronFood ?? ctx.stc.fruitVeg >= 1),
    build: ctx => ({
      interventionId: 'nr_pers_iron_out_gap', pillar: 'Nourish',
      title: 'Iron-rich meal + lemon today',
      dailyAction: ctx.lab.ferritin.value !== null
        ? `Ferritin at ${fmt(ctx.lab.ferritin.value)} ng/mL — eat dal, keerai, or rajma today and squeeze lemon on it`
        : 'Low iron stores — eat an iron-rich food today and squeeze lemon on it',
      detail: ctx.diet?.ironFoodWithTea
        ? 'Also: leave 1 hour between chai/coffee and iron-rich meals — tannins block absorption.'
        : 'Dal, rajma, murungai keerai, or spinach. Lemon or tomato alongside doubles plant-iron absorption.',
      evidenceGrade: 'strong', sourceFindingIds: ['iron_deficiency'],
      rationale: 'Vitamin C keeps non-heme iron in its absorbable form. Ferritin is stored iron — rebuilding it requires consistent daily dietary reinforcement.',
      personalisation: ctx.lab.ferritin.value !== null
        ? `Your Ferritin is ${fmt(ctx.lab.ferritin.value)} ng/mL (${tierLabel(ctx.lab.ferritin.tier)})${ctx.diet?.missingIronFood ? ' and today\'s diet log shows no iron-rich food' : ' — dietary iron is the primary recovery tool'}.`
        : `Your iron stores are ${tierLabel(ctx.lab.ferritin.tier)}${ctx.diet?.missingIronFood ? ' and your diet log shows no iron-rich food today' : ''}.`,
    }),
  },

  {
    priority: 11, id: 'nr_pers_homa_breakfast',
    check: ctx =>
      isOut(ctx.lab.homaIR.tier) &&
      ctx.diet != null &&
      !ctx.diet.breakfastHasProtein &&
      ctx.diet.breakfastTotalKcal > 80,
    build: ctx => ({
      interventionId: 'nr_pers_homa_breakfast', pillar: 'Nourish',
      title: 'Add protein to your carb-heavy breakfast',
      dailyAction: ctx.lab.homaIR.value !== null
        ? `HOMA-IR at ${fmt(ctx.lab.homaIR.value)} — your breakfast had carbs but no protein. Pair it with a boiled egg, curd, or dal`
        : 'Elevated insulin resistance — pair your breakfast carbs with a protein source',
      detail: 'Protein slows gastric emptying and flattens the glucose curve — most effective at the first meal when insulin sensitivity is lowest.',
      evidenceGrade: 'moderate', sourceFindingIds: ['insulin_resistance'],
      rationale: 'Protein alongside carbohydrate reduces the postprandial glucose rise; especially important with elevated HOMA-IR.',
      personalisation: `HOMA-IR is ${fmt(ctx.lab.homaIR.value)} (${tierLabel(ctx.lab.homaIR.tier)}) and today's breakfast log shows carbs without a protein source — this combination specifically raises the morning glucose spike.`,
    }),
  },

  {
    priority: 12, id: 'nr_pers_lipid_legumes',
    check: ctx =>
      isOut(ctx.lab.nonHDL.tier) &&
      (ctx.diet?.missingLegumes ?? ctx.stc.wholeGrains >= 1),
    build: ctx => ({
      interventionId: 'nr_pers_lipid_legumes', pillar: 'Nourish',
      title: 'Eat a bowl of dal or beans today',
      dailyAction: ctx.lab.nonHDL.value !== null
        ? `Non-HDL at ${fmt(ctx.lab.nonHDL.value, 0)} mg/dL — a bowl of dal today provides the soluble fibre that lowers LDL by ~5%`
        : 'Cholesterol is out of range — soluble fibre from dal is your strongest dietary lever',
      detail: 'Toor dal, moong, chana, rajma, or sundal — any form. Soluble fibre binds cholesterol in the gut and carries it out.',
      evidenceGrade: 'strong', sourceFindingIds: ['dyslipidemia', 'cardiometabolic_risk'],
      rationale: '≥3 g/day of legume or oat beta-glucan lowers LDL by ~5% — a health claim backed by dozens of RCTs.',
      personalisation: `Non-HDL is ${fmt(ctx.lab.nonHDL.value, 0)} mg/dL (${tierLabel(ctx.lab.nonHDL.tier)})${ctx.diet?.missingLegumes ? ' and no legumes appear in today\'s diet log' : ' — legumes are your most evidence-backed dietary tool here'}.`,
    }),
  },

  // ── P2: out_of_range lab + STC corroborates poor pattern ───────────────

  {
    priority: 20, id: 'nr_pers_homa_grains_stc',
    check: ctx =>
      isOut(ctx.lab.homaIR.tier) &&
      ctx.stc.wholeGrains >= 2 &&
      ctx.diet == null,
    build: ctx => ({
      interventionId: 'nr_pers_homa_grains_stc', pillar: 'Nourish',
      title: 'Swap white rice for a whole grain at one meal',
      dailyAction: ctx.lab.homaIR.value !== null
        ? `HOMA-IR ${fmt(ctx.lab.homaIR.value)} and you rarely eat whole grains — swapping white rice for ragi or red rice today is your highest-impact meal change`
        : 'Elevated HOMA-IR and low whole-grain intake — swap white rice for ragi or oats at one meal',
      detail: 'Ragi (kezhvaragu), kambu, thinai, or oats. Millets have a much lower GI than white rice and are widely available.',
      evidenceGrade: 'moderate', sourceFindingIds: ['insulin_resistance'],
      rationale: 'Whole grains improve insulin sensitivity and reduce the glycaemic response; replacing refined grains is a high-leverage dietary change.',
      personalisation: `HOMA-IR is ${fmt(ctx.lab.homaIR.value)} (${tierLabel(ctx.lab.homaIR.tier)}) and your questionnaire shows you rarely eat whole grains — this combination makes the whole-grain swap your single highest-impact dietary change.`,
    }),
  },

  {
    priority: 21, id: 'nr_pers_tg_sugary_stc',
    check: ctx =>
      isOut(ctx.lab.tg.tier) &&
      ctx.stc.sugaryDrinks >= 1,
    build: ctx => {
      const bev = ctx.diet?.beverageKcal
      return {
        interventionId: 'nr_pers_tg_sugary_stc', pillar: 'Nourish',
        title: 'Cut sugary drinks — your triglycerides need it',
        dailyAction: ctx.lab.tg.value !== null
          ? `Triglycerides at ${fmt(ctx.lab.tg.value, 0)} mg/dL${bev && bev > 100 ? ` and ~${bev} kcal from drinks today` : ''} — cut one sugary drink now and replace with water or buttermilk`
          : 'Triglycerides out of range + frequent sugary drinks — cut one today',
        detail: 'Sugary drinks (including packaged juice) raise triglycerides within hours of drinking. Buttermilk (moru) or coconut water are good swaps.',
        evidenceGrade: 'strong', sourceFindingIds: ['dyslipidemia'],
        rationale: 'Fructose from sugary drinks is the most potent dietary driver of elevated triglycerides; even a 2-week reduction is measurable.',
        personalisation: `Triglycerides are ${fmt(ctx.lab.tg.value, 0)} mg/dL (${tierLabel(ctx.lab.tg.tier)}) and your questionnaire shows you drink sugary beverages regularly — this is the most direct dietary cause-and-effect.`,
      }
    },
  },

  // ── P3: watch-tier lab + diet log gap ──────────────────────────────────

  {
    priority: 30, id: 'nr_pers_iron_watch_gap',
    check: ctx =>
      isWatch(ctx.lab.ferritin.tier) && !isOut(ctx.lab.ferritin.tier) &&
      (ctx.diet?.missingIronFood ?? false),
    build: ctx => ({
      interventionId: 'nr_pers_iron_watch_gap', pillar: 'Nourish',
      title: 'Iron-rich food today',
      dailyAction: ctx.lab.ferritin.value !== null
        ? `Ferritin at ${fmt(ctx.lab.ferritin.value)} ng/mL (borderline) and no iron-rich food in your log — add dal, keerai, or rajma to a meal`
        : 'Borderline iron + no iron-rich food today — dal or keerai is the easiest fix',
      detail: 'Pair with lemon or tomato to boost absorption. Leave an hour between chai and the meal.',
      evidenceGrade: 'moderate', sourceFindingIds: ['iron_deficiency'],
      rationale: 'Consistent daily dietary iron intake is needed to gradually rebuild borderline-low ferritin stores.',
      personalisation: `Ferritin is ${fmt(ctx.lab.ferritin.value)} ng/mL (borderline low) and today's diet log shows no iron-rich foods — daily reinforcement is how borderline stores are rebuilt.`,
    }),
  },

  {
    priority: 31, id: 'nr_pers_iron_tea_timing',
    check: ctx =>
      isWatch(ctx.lab.ferritin.tier) &&
      (ctx.diet?.ironFoodWithTea ?? false),
    build: ctx => ({
      interventionId: 'nr_pers_iron_tea_timing', pillar: 'Nourish',
      title: 'Space chai away from iron-rich meals',
      dailyAction: ctx.lab.ferritin.value !== null
        ? `Ferritin at ${fmt(ctx.lab.ferritin.value)} ng/mL — you have chai and iron-rich food in your log. Leave 1 hour between them to protect absorption`
        : 'Borderline iron stores — leave 1 hour between chai/coffee and iron-rich meals',
      detail: 'Tannins in tea and coffee bind plant iron and block absorption. This single timing change meaningfully improves iron uptake.',
      evidenceGrade: 'moderate', sourceFindingIds: ['iron_deficiency'],
      rationale: 'Polyphenols in tea inhibit non-heme iron absorption; a 1-hour gap around iron-rich meals substantially improves uptake.',
      personalisation: `Ferritin is ${fmt(ctx.lab.ferritin.value)} ng/mL (borderline) and today's log shows chai alongside iron-rich food — tannins actively block the iron you're eating.`,
    }),
  },

  {
    priority: 32, id: 'nr_pers_crp_omega3',
    check: ctx => isWatch(ctx.lab.hsCRP.tier),
    build: ctx => ({
      interventionId: 'nr_pers_crp_omega3', pillar: 'Nourish',
      title: 'Add an omega-3 source today',
      dailyAction: ctx.lab.hsCRP.value !== null
        ? `hs-CRP at ${fmt(ctx.lab.hsCRP.value)} mg/L — ${ctx.profile.isVegetarian ? '1 tbsp ground flaxseed in curd or porridge' : 'sardines, mackerel, or 1 tbsp ground flaxseed'} today`
        : 'Elevated inflammation — omega-3 foods are your top dietary anti-inflammatory today',
      detail: ctx.profile.isVegetarian
        ? 'Stir 1 tbsp of ground flaxseed or chia into curd, dal, or porridge.'
        : 'A palm-sized portion of sardines (mathi) or mackerel (ayala), or 1 tbsp ground flaxseed.',
      evidenceGrade: 'moderate', sourceFindingIds: ['inflammation'],
      rationale: 'Omega-3 fatty acids (EPA/DHA from fish; ALA from flax/chia) reduce inflammatory cytokines and can lower CRP over weeks.',
      personalisation: `hs-CRP is ${fmt(ctx.lab.hsCRP.value)} mg/L (${tierLabel(ctx.lab.hsCRP.tier)}), indicating low-grade systemic inflammation. Omega-3 foods directly target this biomarker.`,
    }),
  },

  {
    priority: 33, id: 'nr_pers_vitd_gap',
    check: ctx =>
      isWatch(ctx.lab.vitaminD.tier) &&
      (ctx.diet?.missingVitDFood ?? true),
    build: ctx => ({
      interventionId: 'nr_pers_vitd_gap', pillar: 'Nourish',
      title: 'Eat a vitamin D food today',
      dailyAction: ctx.lab.vitaminD.value !== null
        ? `Vitamin D at ${fmt(ctx.lab.vitaminD.value, 0)} ng/mL — add ${ctx.profile.isVegetarian ? 'a glass of fortified milk or egg yolk' : 'egg yolk, oily fish, or fortified milk'} to a meal`
        : 'Vitamin D is borderline — add an egg yolk or a glass of milk today',
      detail: ctx.profile.isVegetarian
        ? 'Fortified milk, egg yolk, or mushrooms left in sunlight for 30 minutes before cooking.'
        : 'Egg yolk, oily fish, or fortified milk. Diet alone cannot fully restore low stores — pair with sunlight.',
      evidenceGrade: 'moderate', sourceFindingIds: ['vitamin_d_low'],
      rationale: 'Dietary vitamin D supplements sunlight synthesis, especially when stores are low; eggs and dairy are the most accessible sources.',
      personalisation: `Vitamin D is ${fmt(ctx.lab.vitaminD.value, 0)} ng/mL (${tierLabel(ctx.lab.vitaminD.tier)})${ctx.diet ? ' and no vitamin D-rich foods appear in today\'s log' : ' — dietary sources complement supplementation and sunlight'}.`,
    }),
  },

  {
    priority: 34, id: 'nr_pers_b12',
    check: ctx =>
      (isWatch(ctx.lab.b12.tier) || ctx.profile.metformin) &&
      (ctx.diet?.missingB12Food ?? true),
    build: ctx => ({
      interventionId: 'nr_pers_b12', pillar: 'Nourish',
      title: 'Eat a B12-rich food today',
      dailyAction: ctx.profile.metformin
        ? `Metformin depletes B12 over time — add eggs, curd, or milk today${ctx.lab.b12.value !== null ? ` (B12 at ${fmt(ctx.lab.b12.value, 0)} pg/mL)` : ''}`
        : ctx.lab.b12.value !== null
          ? `B12 at ${fmt(ctx.lab.b12.value, 0)} pg/mL (borderline) — add eggs, curd, or milk to a meal today`
          : 'B12 is borderline — add curd, eggs, or milk today',
      detail: 'Curd, milk, eggs, or paneer are the most accessible B12 sources. If vegan, a fortified cereal is the best option.',
      evidenceGrade: 'moderate', sourceFindingIds: ['b12_folate_low'],
      rationale: 'B12 is required for healthy red cells and nerve function; metformin reduces intestinal absorption, making daily dietary B12 important.',
      personalisation: ctx.profile.metformin
        ? `You take metformin, which reduces B12 absorption over time${ctx.lab.b12.value !== null ? ` — and B12 is already at ${fmt(ctx.lab.b12.value, 0)} pg/mL (${tierLabel(ctx.lab.b12.tier)})` : ''}. Daily dietary reinforcement is important.`
        : `B12 is ${fmt(ctx.lab.b12.value, 0)} pg/mL (${tierLabel(ctx.lab.b12.tier)})${ctx.diet?.missingB12Food ? ' and today\'s log shows no B12-rich foods' : ''}.`,
    }),
  },

  {
    priority: 35, id: 'nr_pers_liver_sugar',
    check: ctx =>
      (isWatch(ctx.lab.fli.tier) || isWatch(ctx.lab.alt.tier)) &&
      (ctx.diet?.hasSugaryDrink ?? ctx.stc.sugaryDrinks >= 1),
    build: ctx => {
      const fli = ctx.lab.fli.value
      const bev = ctx.diet?.beverageKcal
      return {
        interventionId: 'nr_pers_liver_sugar', pillar: 'Nourish',
        title: 'Cut sugary drinks — liver priority',
        dailyAction: fli !== null
          ? `Fatty Liver Index ${fmt(fli, 0)}${bev && bev > 80 ? ` + ~${bev} kcal from drinks` : ''} — swap one sugary drink for water or buttermilk today`
          : 'Borderline liver markers + sugary drink habit — one swap today makes a real difference',
        detail: 'Fructose from sugary drinks and juices directly drives liver fat. Even buttermilk or coconut water is a strong swap.',
        evidenceGrade: 'moderate', sourceFindingIds: ['liver_stress'],
        rationale: 'Fructose from sugary drinks is a primary driver of hepatic fat accumulation; reducing intake can reverse early steatosis.',
        personalisation: fli !== null
          ? `Fatty Liver Index is ${fmt(fli, 0)} (${tierLabel(ctx.lab.fli.tier)}) and your diet includes sugary beverages — fructose from drinks is a direct cause of liver fat accumulation.`
          : `Liver enzymes are borderline and your diet includes sugary drinks — this is the most direct dietary link to liver inflammation.`,
      }
    },
  },

  {
    priority: 36, id: 'nr_pers_homa_watch_stc',
    check: ctx =>
      isWatch(ctx.lab.homaIR.tier) && !isOut(ctx.lab.homaIR.tier) &&
      ctx.stc.wholeGrains >= 1,
    build: ctx => ({
      interventionId: 'nr_pers_homa_watch_stc', pillar: 'Nourish',
      title: 'Swap refined grains at one meal',
      dailyAction: ctx.lab.homaIR.value !== null
        ? `HOMA-IR ${fmt(ctx.lab.homaIR.value)} and irregular whole-grain intake — try ragi, red rice, or oats instead of white rice at one meal today`
        : 'Borderline insulin resistance — swap white rice for a whole grain at one meal today',
      detail: 'Ragi (kezhvaragu), kambu, thinai, samai, or oats lower the glycaemic response significantly compared to white rice.',
      evidenceGrade: 'moderate', sourceFindingIds: ['insulin_resistance'],
      rationale: 'Whole grains improve insulin sensitivity and reduce postprandial glucose spikes; effect compounds with consistency.',
      personalisation: `HOMA-IR is ${fmt(ctx.lab.homaIR.value)} (borderline) and your questionnaire shows inconsistent whole-grain intake — replacing even one refined-grain meal daily directly improves insulin sensitivity.`,
    }),
  },

  // ── P3b: Macro + lab bridges (insert between lab rules and symptom bridges) ──

  {
    priority: 37, id: 'nr_pers_macro_protein_homa',
    check: ctx =>
      (ctx.diet?.lowProtein ?? false) &&
      isWatch(ctx.lab.homaIR.tier),
    build: ctx => {
      const d = ctx.diet!
      const target = d.macroTargets?.protein_g
      return {
        interventionId: 'nr_pers_macro_protein_homa', pillar: 'Nourish',
        title: 'Add protein to your next meal',
        dailyAction: `HOMA-IR at ${fmt(ctx.lab.homaIR.value)} and protein logged so far is only ~${Math.round(d.macros.protein_g)}g${target ? ` (target ~${target}g)` : ''} — protein eaten alongside carbs directly flattens the glucose spike`,
        detail: 'Dal, curd, eggs, or paneer at your next meal closes the protein gap and stabilises blood sugar in one step.',
        evidenceGrade: 'moderate', sourceFindingIds: ['insulin_resistance'],
        rationale: 'Protein slows gastric emptying and reduces the postprandial glucose rise; it also increases satiety and reduces compensatory carb intake later.',
        personalisation: `Your diet log shows ~${Math.round(d.macros.protein_g)}g of protein so far${target ? ` vs a ~${target}g daily target based on your weight` : ''}, and HOMA-IR is ${fmt(ctx.lab.homaIR.value)} (borderline). Protein eaten with carbs is one of the most direct tools for managing the glucose spike that drives insulin resistance.`,
      }
    },
  },

  {
    priority: 38, id: 'nr_pers_macro_fiber_lipid',
    check: ctx =>
      (ctx.diet?.lowFiber ?? false) &&
      isWatch(ctx.lab.nonHDL.tier),
    build: ctx => {
      const d = ctx.diet!
      const target = d.macroTargets?.fiber_g
      return {
        interventionId: 'nr_pers_macro_fiber_lipid', pillar: 'Nourish',
        title: 'Add a high-fiber food — lipid priority',
        dailyAction: `Fiber logged so far is ~${Math.round(d.macros.fiber_g)}g${target ? ` (target ~${target}g/day)` : ''} and Non-HDL is ${fmt(ctx.lab.nonHDL.value, 0)} mg/dL — a bowl of dal or oats today adds 5–8g of soluble fibre that directly lowers LDL`,
        detail: 'Dal, rajma, oats, or sundal. Soluble fibre binds cholesterol in the gut and carries it out — it\'s the most direct dietary tool for LDL.',
        evidenceGrade: 'strong', sourceFindingIds: ['dyslipidemia'],
        rationale: 'Soluble fibre (≥3 g/day from oats/legumes) lowers LDL by ~5% — a health claim backed by dozens of RCTs; it works by binding bile acids and cholesterol in the intestine.',
        personalisation: `Today's fiber intake is ~${Math.round(d.macros.fiber_g)}g${target ? ` vs a ~${target}g daily target` : ''}, and Non-HDL is ${fmt(ctx.lab.nonHDL.value, 0)} mg/dL (${isWatch(ctx.lab.nonHDL.tier) ? 'borderline' : 'out of range'}). Soluble fibre from legumes or oats is the most direct dietary mechanism for lowering LDL — and your intake today needs it.`,
      }
    },
  },

  {
    priority: 39, id: 'nr_pers_macro_protein_age',
    check: ctx =>
      (ctx.diet?.lowProtein ?? false) &&
      (ctx.profile.age ?? 0) >= 50,
    build: ctx => {
      const d = ctx.diet!
      const target = d.macroTargets?.protein_g
      return {
        interventionId: 'nr_pers_macro_protein_age', pillar: 'Nourish',
        title: 'Boost protein — muscle preservation priority',
        dailyAction: `Protein logged is ~${Math.round(d.macros.protein_g)}g${target ? ` (target ~${target}g)` : ''} and you are ${ctx.profile.age} — protein needs increase after 50 for muscle preservation. Add dal, eggs, curd, or paneer to your next meal`,
        detail: 'Any protein source works: dal with rice, curd alongside a meal, or an egg at breakfast. Spreading protein across meals helps absorption.',
        evidenceGrade: 'moderate', sourceFindingIds: [],
        rationale: 'Anabolic resistance means older adults need 1.2–1.6 g/kg/day of protein (vs 0.8 g/kg in younger adults) to maintain the same muscle protein synthesis rate.',
        personalisation: `You are ${ctx.profile.age} and today's protein intake is ~${Math.round(d.macros.protein_g)}g${target ? ` vs a ~${target}g target adjusted for your age` : ''}. Protein requirements increase after 50 because muscle responds less efficiently — higher intake is needed to get the same muscle-preservation effect.`,
      }
    },
  },

  // ── P4: Symptom + lab bridges ───────────────────────────────────────────

  {
    priority: 40, id: 'nr_pers_hair_iron',
    check: ctx => ctx.profile.hairLoss && isWatch(ctx.lab.ferritin.tier),
    build: ctx => ({
      interventionId: 'nr_pers_hair_iron', pillar: 'Nourish',
      title: 'Iron-rich meal — hair + ferritin connection',
      dailyAction: ctx.lab.ferritin.value !== null
        ? `Hair loss + ferritin at ${fmt(ctx.lab.ferritin.value)} ng/mL are often connected — eat dal or keerai with lemon today`
        : 'Hair loss + borderline iron stores are often connected — eat an iron-rich food with lemon today',
      detail: 'Dal, rajma, murungai keerai, pumpkin seeds, or dates. Lemon or amla alongside doubles absorption.',
      evidenceGrade: 'moderate', sourceFindingIds: ['iron_deficiency'],
      rationale: 'Iron deficiency is one of the most common and reversible causes of diffuse hair loss; ferritin is the key marker.',
      personalisation: `You reported hair loss and Ferritin is ${fmt(ctx.lab.ferritin.value)} ng/mL (${tierLabel(ctx.lab.ferritin.tier)}) — iron deficiency is the most common and most reversible nutritional cause of hair loss. These two signals together make iron the clear priority.`,
    }),
  },

  {
    priority: 41, id: 'nr_pers_crash_breakfast',
    check: ctx =>
      ctx.profile.afternoonCrashes &&
      (ctx.stc.breakfastFreq >= 1 || (ctx.diet?.breakfastEmpty ?? false)),
    build: () => ({
      interventionId: 'nr_pers_crash_breakfast', pillar: 'Nourish',
      title: 'Protein-rich breakfast to fix afternoon crashes',
      dailyAction: 'You skip or skip most breakfasts and report afternoon crashes — these are connected. Try 2 eggs, curd with fruit, or pesarattu today',
      detail: 'A protein-rich breakfast steadies cortisol and blood sugar through the morning, eliminating the 3 pm energy dip.',
      evidenceGrade: 'moderate', sourceFindingIds: [],
      rationale: 'Protein at breakfast improves satiety, steadies morning glucose, and reduces the postprandial spike that causes afternoon fatigue.',
      personalisation: 'You reported afternoon energy crashes and your questionnaire shows you skip breakfast most days — skipping breakfast causes a late-morning glucose dip that compounds into the afternoon crash you\'re experiencing.',
    }),
  },

  {
    priority: 42, id: 'nr_pers_bloating_fermented',
    check: ctx => ctx.profile.bloating,
    build: () => ({
      interventionId: 'nr_pers_bloating_fermented', pillar: 'Nourish',
      title: 'Fermented food for bloating',
      dailyAction: 'You reported bloating — add a fermented food: a cup of curd, a glass of buttermilk, or home-fermented idli/dosa batter',
      detail: 'Live cultures in fermented foods support gut microbiome diversity and can ease bloating over days to weeks.',
      evidenceGrade: 'moderate', sourceFindingIds: [],
      rationale: 'Fermented foods containing live cultures improve gut microbiome composition and reduce bloating symptoms.',
      personalisation: 'You reported bloating as a symptom. Fermented foods directly address gut dysbiosis, which is the most common dietary cause of persistent bloating.',
    }),
  },

  {
    priority: 43, id: 'nr_pers_headache_hydration',
    check: ctx => ctx.profile.headaches,
    build: () => ({
      interventionId: 'nr_pers_headache_hydration', pillar: 'Nourish',
      title: 'Hydration check — headache trigger',
      dailyAction: 'You reported headaches — mild dehydration is a common trigger. Aim for 8 glasses of water today, starting with one right now',
      detail: 'A glass on waking and one before each meal hits the daily target without counting.',
      evidenceGrade: 'moderate', sourceFindingIds: [],
      rationale: 'Mild dehydration is a well-documented trigger for tension-type headaches; consistent hydration reduces frequency.',
      personalisation: 'You reported headaches as a recurring symptom. Mild dehydration is the most common and most easily correctable dietary trigger for headaches.',
    }),
  },

  // ── P5: AUDIT-C + lab ──────────────────────────────────────────────────

  {
    priority: 50, id: 'nr_pers_alcohol_liver',
    check: ctx =>
      ctx.alcohol.riskFlag &&
      (isWatch(ctx.lab.alt.tier) || isWatch(ctx.lab.ggt.tier) || isWatch(ctx.lab.fli.tier)),
    build: ctx => ({
      interventionId: 'nr_pers_alcohol_liver', pillar: 'Nourish',
      title: 'Alcohol-free day — liver priority',
      dailyAction: 'Borderline liver markers + risky alcohol pattern — make today alcohol-free. Even 2–3 dry days/week measurably lowers liver enzymes within 4–6 weeks',
      detail: 'Dry days allow the liver to clear fat and reduce inflammation. The change is measurable in blood tests within weeks.',
      evidenceGrade: 'strong', sourceFindingIds: ['liver_stress', 'risky_alcohol'],
      rationale: 'Alcohol is metabolised in the liver; regular dry days reduce fat accumulation and measurably lower ALT and GGT.',
      personalisation: `Your AUDIT-C score shows alcohol intake above the low-risk threshold${ctx.lab.alt.value !== null ? ` and ALT/GGT is borderline` : ` and liver markers are borderline`} — alcohol is the most direct modifiable dietary cause of this liver pattern.`,
    }),
  },

  {
    priority: 51, id: 'nr_pers_alcohol_tg',
    check: ctx => ctx.alcohol.riskFlag && isWatch(ctx.lab.tg.tier),
    build: ctx => ({
      interventionId: 'nr_pers_alcohol_tg', pillar: 'Nourish',
      title: 'Alcohol-free day — triglycerides',
      dailyAction: ctx.lab.tg.value !== null
        ? `Triglycerides at ${fmt(ctx.lab.tg.value, 0)} mg/dL and alcohol use above low-risk — make today alcohol-free`
        : 'Borderline triglycerides + risky alcohol pattern — an alcohol-free day is your highest-impact change today',
      detail: 'Alcohol raises triglycerides within hours of drinking. Two dry days a week has a measurable effect within weeks.',
      evidenceGrade: 'strong', sourceFindingIds: ['dyslipidemia', 'risky_alcohol'],
      rationale: 'Alcohol is the most potent dietary driver of elevated triglycerides; even moderate intake substantially raises TG.',
      personalisation: `Triglycerides are ${fmt(ctx.lab.tg.value, 0)} mg/dL (${tierLabel(ctx.lab.tg.tier)}) and your AUDIT-C score shows regular alcohol use — alcohol directly raises triglycerides within hours of drinking.`,
    }),
  },

  // ── P6: Medication-depletion bridges ───────────────────────────────────

  {
    priority: 55, id: 'nr_pers_antacid_iron',
    check: ctx => ctx.profile.antacid && isWatch(ctx.lab.ferritin.tier),
    build: ctx => ({
      interventionId: 'nr_pers_antacid_iron', pillar: 'Nourish',
      title: 'Time iron foods away from antacid',
      dailyAction: ctx.lab.ferritin.value !== null
        ? `Ferritin at ${fmt(ctx.lab.ferritin.value)} ng/mL and on an antacid — eat iron-rich foods at least 2 hours away from your tablet`
        : 'Antacids reduce iron absorption — space iron-rich meals ≥2 hours from your medication',
      detail: 'Stomach acid is needed to absorb iron. PPIs and H2 blockers reduce it. Timing your meals away from the dose partially restores absorption.',
      evidenceGrade: 'moderate', sourceFindingIds: ['iron_deficiency'],
      rationale: 'Antacids reduce gastric acid, impairing iron absorption; a ≥2-hour gap from the dose substantially improves uptake.',
      personalisation: `You take an antacid/PPI and Ferritin is ${fmt(ctx.lab.ferritin.value)} ng/mL (${tierLabel(ctx.lab.ferritin.tier)}) — antacids reduce stomach acid, which is needed to absorb iron, creating a direct drug-nutrient interaction.`,
    }),
  },

  // ── P7: Family history amplification ───────────────────────────────────

  {
    priority: 60, id: 'nr_pers_family_cardio',
    check: ctx =>
      ctx.profile.familyCardio &&
      isWatch(ctx.lab.nonHDL.tier),
    build: ctx => ({
      interventionId: 'nr_pers_family_cardio', pillar: 'Nourish',
      title: 'Soluble fibre — your heart-protection priority',
      dailyAction: ctx.lab.nonHDL.value !== null
        ? `Family history of heart disease + Non-HDL ${fmt(ctx.lab.nonHDL.value, 0)} mg/dL — a bowl of dal and a handful of nuts today is your best dietary defence`
        : 'Family history of cardiovascular disease + borderline lipids — soluble fibre is your most evidence-backed dietary protection today',
      detail: 'Dal, rajma, oats, and a small handful of groundnuts or almonds. Soluble fibre lowers LDL; nuts lower cardiovascular risk even daily.',
      evidenceGrade: 'strong', sourceFindingIds: ['dyslipidemia', 'cardiometabolic_risk'],
      rationale: 'Family history elevates baseline CVD risk; soluble fibre (≥3 g/day) lowers LDL by ~5% and is the most accessible dietary intervention.',
      personalisation: `You have a family history of cardiovascular disease and Non-HDL is ${fmt(ctx.lab.nonHDL.value, 0)} mg/dL (${tierLabel(ctx.lab.nonHDL.tier)}) — family history amplifies the importance of dietary intervention for your lipid profile.`,
    }),
  },

  {
    priority: 61, id: 'nr_pers_family_diabetes',
    check: ctx =>
      ctx.profile.familyDiabetes &&
      isWatch(ctx.lab.homaIR.tier),
    build: ctx => ({
      interventionId: 'nr_pers_family_diabetes', pillar: 'Nourish',
      title: 'Whole grains — diabetes prevention',
      dailyAction: ctx.lab.homaIR.value !== null
        ? `Family history of diabetes + HOMA-IR ${fmt(ctx.lab.homaIR.value)} — swap white rice for ragi or red rice at one meal today`
        : 'Family history of diabetes + borderline HOMA-IR — swap one refined grain for ragi, oats, or red rice today',
      detail: 'Ragi, kambu, thinai, or oats. Replacing refined grains at even one meal daily compounds to meaningful insulin-sensitivity improvement.',
      evidenceGrade: 'moderate', sourceFindingIds: ['insulin_resistance', 'diabetes_risk'],
      rationale: 'Whole grains improve insulin sensitivity; combined with family history, this is one of the highest-leverage dietary changes available.',
      personalisation: `Your family history includes diabetes and HOMA-IR is ${fmt(ctx.lab.homaIR.value)} (${tierLabel(ctx.lab.homaIR.tier)}) — these two signals together make whole-grain substitution your highest-priority dietary habit.`,
    }),
  },

  // ── P8: Condition-specific ──────────────────────────────────────────────

  {
    priority: 65, id: 'nr_pers_pcos_lowgi',
    check: ctx => ctx.profile.pcos,
    build: ctx => ({
      interventionId: 'nr_pers_pcos_lowgi', pillar: 'Nourish',
      title: 'Low-GI eating — PCOS management',
      dailyAction: ctx.stc.wholeGrains <= 1
        ? 'You manage PCOS — keep up the whole grains and add legumes to the same meal today for lower-GI eating'
        : 'PCOS responds directly to low-GI eating — swap white rice for ragi or oats at one meal and add a legume today',
      detail: 'Low-GI foods (ragi, oats, lentils, legumes) reduce insulin spikes, which directly improves PCOS hormone balance.',
      evidenceGrade: 'moderate', sourceFindingIds: ['pcos_suggestive'],
      rationale: 'Insulin resistance drives androgen excess in PCOS; low-GI diets reduce insulin demand and improve hormonal and metabolic outcomes.',
      personalisation: 'You have PCOS recorded as a condition. Insulin resistance is the primary driver of PCOS hormone imbalance — low-GI eating is therefore the most targeted nutritional intervention for your condition.',
    }),
  },

  {
    priority: 66, id: 'nr_pers_bowel_constipation',
    check: ctx => ctx.profile.bowelStatus === 'Often constipated',
    build: () => ({
      interventionId: 'nr_pers_bowel_constipation', pillar: 'Nourish',
      title: 'Flaxseed + water for constipation',
      dailyAction: 'You often feel constipated — add 1 tbsp ground flaxseed to curd or porridge today and aim for 8+ glasses of water',
      detail: 'Ground flaxseed must be paired with plenty of water to work. Take it at the same meal each day.',
      evidenceGrade: 'moderate', sourceFindingIds: [],
      rationale: 'Soluble fibre from flaxseed is one of the most effective dietary interventions for constipation; hydration is essential for its action.',
      personalisation: 'You reported often feeling constipated. Soluble fibre from ground flaxseed combined with adequate hydration is the most evidence-backed dietary combination for this specific bowel pattern.',
    }),
  },

  {
    priority: 67, id: 'nr_pers_bowel_loose',
    check: ctx => ctx.profile.bowelStatus === 'Loose or frequent',
    build: () => ({
      interventionId: 'nr_pers_bowel_loose', pillar: 'Nourish',
      title: 'Gut-calming foods today',
      dailyAction: 'You report loose or frequent stools — stick to cooked dal, rice, curd, and banana today; avoid raw salads and fried foods',
      detail: 'Cooked foods are gentler on an irritated gut. Curd adds live cultures. Avoid raw vegetables and high-fibre snacks today.',
      evidenceGrade: 'moderate', sourceFindingIds: [],
      rationale: 'Low-residue cooked foods reduce gut irritation; probiotics in curd support microbiome balance during loose stool episodes.',
      personalisation: 'You reported loose or frequent stools as your usual bowel pattern. Low-residue cooked foods reduce gut transit time and irritation — this is the dietary approach most matched to your bowel pattern.',
    }),
  },

  // ── P8b: Macro-only fiber gap (no strong lab signal) ───────────────────

  {
    priority: 62, id: 'nr_pers_macro_fiber_gap',
    check: ctx =>
      (ctx.diet?.lowFiber ?? false) &&
      !isWatch(ctx.lab.nonHDL.tier) &&
      ctx.stc.wholeGrains >= 1,
    build: ctx => {
      const d = ctx.diet!
      const target = d.macroTargets?.fiber_g
      return {
        interventionId: 'nr_pers_macro_fiber_gap', pillar: 'Nourish',
        title: 'Boost fiber today',
        dailyAction: `Fiber logged so far is ~${Math.round(d.macros.fiber_g)}g${target ? ` vs ~${target}g/day` : ''} — dal or oats at one meal adds 5–8g and closes the gap`,
        detail: 'Dal, rajma, oats, or whole fruit. Fibre regulates satiety, blood sugar, and cholesterol — and most Indian diets fall short.',
        evidenceGrade: 'moderate', sourceFindingIds: ['diet_quality'],
        rationale: 'Adequate dietary fibre (25–38 g/day) is protective against insulin resistance, high cholesterol, colorectal cancer, and all-cause mortality.',
        personalisation: `Today's fiber intake is ~${Math.round(d.macros.fiber_g)}g${target ? ` vs a ~${target}g daily target` : ''}. Your questionnaire also shows inconsistent whole-grain intake — both signals point to fibre as a gap worth closing today.`,
      }
    },
  },

  // ── P9: Diet log + calorie balance ─────────────────────────────────────

  {
    priority: 70, id: 'nr_pers_calorie_over',
    check: ctx =>
      ctx.diet != null &&
      ctx.diet.tdee != null &&
      ctx.diet.logged > 0 &&
      ctx.diet.logged > ctx.diet.tdee * 1.2 &&
      isWatch(ctx.lab.homaIR.tier),
    build: ctx => {
      const d = ctx.diet!
      return {
        interventionId: 'nr_pers_calorie_over', pillar: 'Nourish',
        title: 'Trim calories — insulin sensitivity',
        dailyAction: `~${Math.round(d.logged)} kcal logged vs ~${Math.round(d.tdee!)} target. With HOMA-IR at ${fmt(ctx.lab.homaIR.value)}, getting closer to target directly improves insulin sensitivity`,
        detail: 'The easiest cut is usually refined carbs and sugary drinks — no need to count every calorie, just trim the obvious sources.',
        evidenceGrade: 'moderate', sourceFindingIds: ['insulin_resistance'],
        rationale: 'Caloric excess directly worsens insulin resistance; even modest reductions improve HOMA-IR within weeks.',
        personalisation: `Your diet log shows ~${Math.round(d.logged)} kcal against an estimated ${Math.round(d.tdee!)} kcal daily target (${Math.round((d.logged / d.tdee!) * 100)}% of target), and HOMA-IR is borderline — caloric excess is a direct driver of insulin resistance.`,
      }
    },
  },

  {
    priority: 71, id: 'nr_pers_snack_swap',
    check: ctx => ctx.diet?.hasHighKcalSnack ?? false,
    build: ctx => {
      const snack = ctx.diet!.highKcalSnackName ?? 'that snack'
      return {
        interventionId: 'nr_pers_snack_swap', pillar: 'Nourish',
        title: 'Swap your high-calorie snack',
        dailyAction: `Your ${snack} adds ~200–260 kcal of refined fat. Try roasted chana or sundal tomorrow — same crunch, half the calories, extra protein`,
        detail: 'Roasted chana (~120 kcal/cup) provides protein and fibre. Sundal (legume-based) adds further nutritional value.',
        evidenceGrade: 'moderate', sourceFindingIds: ['diet_quality'],
        rationale: 'Ultra-processed snack replacement with whole-food alternatives reduces calorie density and improves micronutrient intake.',
        personalisation: `Today's diet log shows ${snack} as your snack — this adds 200–260 kcal of refined fat with little nutritional return. Whole-food snacks in the same slot cut calories and add protein and fibre.`,
      }
    },
  },

  // ── P9b: Refined carb pattern ──────────────────────────────────────────

  {
    priority: 72, id: 'nr_pers_macro_refined_carb',
    check: ctx => ctx.diet?.refinedCarbPattern ?? false,
    build: ctx => {
      const d = ctx.diet!
      return {
        interventionId: 'nr_pers_macro_refined_carb', pillar: 'Nourish',
        title: 'Swap a refined grain for a whole grain today',
        dailyAction: `Today's carbs are ~${Math.round(d.macros.carb_g)}g but fiber is only ~${Math.round(d.macros.fiber_g)}g — this pattern suggests mostly refined grains. Swap white rice at one meal for ragi or red rice to add fiber without changing the carb total`,
        detail: 'Ragi (kezhvaragu), oats, kambu, or red rice. The total carbs stay similar — the fiber content is what changes, and that\'s what matters for blood sugar and cholesterol.',
        evidenceGrade: 'moderate', sourceFindingIds: ['diet_quality'],
        rationale: 'The ratio of carbohydrate to fibre is a reliable proxy for grain quality; whole grains provide the same energy with significantly lower glycaemic impact.',
        personalisation: `Your diet log today shows ~${Math.round(d.macros.carb_g)}g of carbohydrates but only ~${Math.round(d.macros.fiber_g)}g of fibre — a high carb-to-fiber ratio characteristic of refined-grain dominant eating. Fibre is what separates whole grains from refined ones nutritionally, and the gap is significant.`,
      }
    },
  },

  // ── P10: STC–vs–diet log divergence ────────────────────────────────────

  {
    priority: 80, id: 'nr_pers_stc_veg_gap',
    check: ctx =>
      ctx.stc.fruitVeg === 0 &&
      (ctx.diet?.missingLeafyVeg ?? false),
    build: () => ({
      interventionId: 'nr_pers_stc_veg_gap', pillar: 'Nourish',
      title: 'Your usual greens are missing today',
      dailyAction: 'You normally eat vegetables daily — your log doesn\'t show any yet. A small poriyal or handful of spinach in dal keeps your streak going',
      detail: 'Even a small handful counts. Stir spinach into dal, or have a side of keerai — 5 minutes.',
      evidenceGrade: 'moderate', sourceFindingIds: ['diet_quality'],
      rationale: 'Maintaining consistent vegetable intake — even on busy days — is the strongest predictor of long-term dietary quality.',
      personalisation: 'Your questionnaire shows you normally eat vegetables daily, but today\'s diet log has none logged yet — one small serving maintains the habit and your micronutrient intake.',
    }),
  },

  {
    priority: 81, id: 'nr_pers_bev_excess',
    check: ctx =>
      (ctx.diet?.beverageKcal ?? 0) > 200 &&
      ctx.stc.sugaryDrinks <= 1,
    build: ctx => {
      const bev = ctx.diet!.beverageKcal
      return {
        interventionId: 'nr_pers_bev_excess', pillar: 'Nourish',
        title: 'Beverage calories adding up today',
        dailyAction: `Your drinks are adding ~${bev} kcal today — more than usual. Try swapping one chai or juice for water or black tea`,
        detail: 'Black tea or coffee without milk/sugar saves 50–60 kcal per cup and keeps the habit.',
        evidenceGrade: 'moderate', sourceFindingIds: ['diet_quality'],
        rationale: 'Liquid calories are under-registered; reducing sugary/milky drinks is a low-effort way to improve daily calorie quality.',
        personalisation: `Today's diet log shows ~${bev} kcal from beverages alone — more than your typical pattern. Beverage calories are easy to overlook but easy to reduce with one swap.`,
      }
    },
  },

  // ── P10b: Low protein alone (no lab signal, no age trigger) ───────────

  {
    priority: 86, id: 'nr_pers_macro_protein_alone',
    check: ctx =>
      (ctx.diet?.lowProtein ?? false) &&
      (ctx.profile.age ?? 0) < 50 &&
      !isWatch(ctx.lab.homaIR.tier),
    build: ctx => {
      const d = ctx.diet!
      const target = d.macroTargets?.protein_g
      return {
        interventionId: 'nr_pers_macro_protein_alone', pillar: 'Nourish',
        title: 'Add a protein source to your next meal',
        dailyAction: `Protein logged is ~${Math.round(d.macros.protein_g)}g${target ? ` vs ~${target}g target based on your weight` : ''} — most Indian diets are protein-light. Dal, curd, eggs, or paneer at your next meal closes the gap`,
        detail: 'Dal with rice, curd alongside a meal, or a boiled egg — any combination works. Spreading protein across meals improves absorption.',
        evidenceGrade: 'moderate', sourceFindingIds: ['diet_quality'],
        rationale: 'Adequate protein intake supports muscle maintenance, satiety, and immune function; Indian vegetarian diets are commonly below weight-based targets.',
        personalisation: `Today's protein log shows ~${Math.round(d.macros.protein_g)}g${target ? ` vs a ~${target}g target based on your body weight` : ''}. Protein is the most commonly under-consumed macronutrient in Indian diets — and it's the one with the clearest per-meal intervention.`,
      }
    },
  },

  // ── P11: STC alone (no lab signal) ─────────────────────────────────────

  {
    priority: 90, id: 'nr_pers_stc_sugary_alone',
    check: ctx =>
      ctx.stc.sugaryDrinks >= 2 &&
      !isWatch(ctx.lab.tg.tier) && !isWatch(ctx.lab.fli.tier),
    build: () => ({
      interventionId: 'nr_pers_stc_sugary_alone', pillar: 'Nourish',
      title: 'Cut one sugary drink today',
      dailyAction: 'You drink sugary beverages daily — this is your highest-risk dietary habit right now. Cut one today and replace with buttermilk, coconut water, or water',
      detail: 'One daily sugary drink raises diabetes risk by ~26% in prospective studies. One swap a day adds up to a big shift over 90 days.',
      evidenceGrade: 'strong', sourceFindingIds: ['diet_quality'],
      rationale: 'Sugar-sweetened beverage intake is consistently linked to type 2 diabetes, cardiovascular disease, and weight gain across large cohort studies.',
      personalisation: 'Your questionnaire shows you drink sugary beverages daily. This is the single highest-risk dietary habit in your profile — it directly drives weight gain, triglycerides, and diabetes risk.',
    }),
  },

  {
    priority: 91, id: 'nr_pers_stc_no_breakfast',
    check: ctx =>
      ctx.stc.breakfastFreq >= 2 &&
      !ctx.profile.afternoonCrashes,
    build: () => ({
      interventionId: 'nr_pers_stc_no_breakfast', pillar: 'Nourish',
      title: 'Eat breakfast today',
      dailyAction: 'You rarely eat breakfast — try a protein-rich one today: 2 eggs, idli with sambar, oats with curd, or pesarattu',
      detail: 'Eating within 2 hours of waking steadies cortisol and reduces the late-morning hunger that leads to poor snack choices.',
      evidenceGrade: 'moderate', sourceFindingIds: ['diet_quality'],
      rationale: 'Regular breakfast improves satiety, metabolic health markers, and cognitive performance through the morning.',
      personalisation: 'Your questionnaire shows you rarely eat breakfast. Skipping the first meal increases cortisol, disrupts appetite hormones, and often leads to compensatory overeating later in the day.',
    }),
  },

  {
    priority: 92, id: 'nr_pers_stc_low_fruitveg',
    check: ctx =>
      ctx.stc.fruitVeg >= 2 &&
      !isWatch(ctx.lab.hsCRP.tier),
    build: () => ({
      interventionId: 'nr_pers_stc_low_fruitveg', pillar: 'Nourish',
      title: 'One serving of fruit or veg today',
      dailyAction: 'Reaching 5 servings of fruit and veg a day is the single most consistent predictor of long-term health — start with one today',
      detail: 'Any whole fruit (not juice), or a handful of any vegetable — raw, cooked, or stirred into a dish.',
      evidenceGrade: 'strong', sourceFindingIds: ['diet_quality'],
      rationale: 'Five or more daily fruit and vegetable servings consistently predict lower all-cause mortality and cardiovascular disease in large cohort studies.',
      personalisation: 'Your questionnaire shows you rarely eat fruit and vegetables. This is the most impactful single dietary pattern change — five daily servings is the threshold with the strongest evidence for health protection.',
    }),
  },

  {
    priority: 93, id: 'nr_pers_stc_processed',
    check: ctx => ctx.stc.processedFood >= 2,
    build: () => ({
      interventionId: 'nr_pers_stc_processed', pillar: 'Nourish',
      title: 'One whole-food swap today',
      dailyAction: 'You eat processed or fast food often — pick one item today and replace it with a whole-food version: sundal instead of chips, curd rice instead of a packet snack',
      detail: 'Each whole-food swap adds nutrients and removes ultra-processed ingredients. One swap a day is all that\'s needed to shift the pattern.',
      evidenceGrade: 'moderate', sourceFindingIds: ['diet_quality'],
      rationale: 'Higher ultra-processed food intake is associated with weight gain, metabolic risk, and all-cause mortality; whole-food replacements reverse this.',
      personalisation: 'Your questionnaire shows you eat processed or fast food often. Ultra-processed foods displace nutrient-dense options and are independently associated with metabolic risk — one swap a day compounds significantly over 90 days.',
    }),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 7. Main builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildNourishTasks(
  ctx: NourishContext,
  _phase: Phase,
  maxTasks = 2,
): PlannedTask[] {
  const used = new Set<string>()
  const tasks: PlannedTask[] = []

  for (const rule of RULES) {
    if (tasks.length >= maxTasks) break
    if (!rule.check(ctx)) continue
    const base = rule.build(ctx)
    if (used.has(base.interventionId)) continue
    used.add(base.interventionId)
    tasks.push({ ...base, isKeystone: false })
  }

  return tasks
}
