// lib/move-engine.ts
//
// Personalized Move task generator. Fuses EVS activity data (exact weekly minutes,
// days, strength frequency, sedentary hours), lab values (HOMA-IR, lipids,
// testosterone), symptom flags, and profile signals into one targeted Move task.

import type { ActivityResponses, SymptomsResponses, QuestionnaireScore } from './types'
import type { LabInterpretation } from './lab-interpretation'
import type { SafetyFlag, Phase, PlannedTask } from './intervention-schema'
import { labVal, isWatch, fmt, type LabVal } from './nourish-engine'

// ─────────────────────────────────────────────────────────────────────────────
// 1. MoveContext
// ─────────────────────────────────────────────────────────────────────────────

export interface MoveContext {
  // Scored values
  activityWellness: number
  // Raw EVS fields
  mvpaDays: number
  mvpaMinutes: number       // per session
  strengthDays: number
  sittingHours: number
  // Derived
  mvpaMinPerWeek: number
  meetsAerobic: boolean
  meetsStrength: boolean
  completelyInactive: boolean
  isLowActive: boolean      // < 75 min/week
  aeroGapMinutes: number    // max(0, 150 − weekly)
  closeToAeroTarget: boolean // >= 100 min/week but not yet meeting it
  strengthGap: boolean
  highSedentary: boolean    // > 8 h/day
  verySedentary: boolean    // > 10 h/day
  // Lab
  lab: {
    homaIR: LabVal
    glucose: LabVal
    nonHDL: LabVal
    tg: LabVal
    testosterone: LabVal
    hsCRP: LabVal
  }
  // Symptoms
  symptoms: {
    lowMotivation: boolean
    afternoonCrashes: boolean
    muscleTension: boolean
    headaches: boolean
  }
  // Profile
  profile: {
    age: number | null
    isMale: boolean
    diabetes: boolean
    cognitionLow: boolean
  }
  safetyFlags: Set<SafetyFlag>
  phase: Phase
}

export function buildMoveContext(
  qScore: QuestionnaireScore,
  activity: ActivityResponses,
  symptoms: SymptomsResponses,
  labInterp: LabInterpretation,
  safetyFlags: SafetyFlag[],
  phase: Phase,
  age: number | null,
  sex: string,
  conditions: string[],
): MoveContext {
  const ad = qScore.domains.activity
  const mvpaMinPerWeek = (ad.meta?.['mvpaMinPerWeek'] as number) ?? (activity.mvpaDays * activity.mvpaMinutes)
  const meetsAerobic   = (ad.meta?.['meetsAerobic']   as boolean) ?? mvpaMinPerWeek >= 150
  const meetsStrength  = (ad.meta?.['meetsStrength']  as boolean) ?? activity.strengthDays >= 2

  const all = [
    ...symptoms.physical.map(s => s.toLowerCase()),
    ...symptoms.energyMood.map(s => s.toLowerCase()),
  ]
  const condStr = conditions.join(' ').toLowerCase()

  return {
    activityWellness:    ad.wellness,
    mvpaDays:            activity.mvpaDays,
    mvpaMinutes:         activity.mvpaMinutes,
    strengthDays:        activity.strengthDays,
    sittingHours:        activity.sittingHours,
    mvpaMinPerWeek,
    meetsAerobic,
    meetsStrength,
    completelyInactive:  activity.mvpaDays === 0,
    isLowActive:         mvpaMinPerWeek < 75,
    aeroGapMinutes:      Math.max(0, 150 - mvpaMinPerWeek),
    closeToAeroTarget:   mvpaMinPerWeek >= 100 && !meetsAerobic,
    strengthGap:         activity.strengthDays < 2,
    highSedentary:       activity.sittingHours > 8,
    verySedentary:       activity.sittingHours > 10,
    lab: {
      homaIR:      labVal(labInterp, 'HOMA-IR'),
      glucose:     labVal(labInterp, 'Fasting Glucose'),
      nonHDL:      labVal(labInterp, 'Non-HDL'),
      tg:          labVal(labInterp, 'Triglycerides'),
      testosterone: labVal(labInterp, 'Total Testosterone'),
      hsCRP:       labVal(labInterp, 'hs-CRP'),
    },
    symptoms: {
      lowMotivation:    all.some(s => s.includes('motivation')),
      afternoonCrashes: all.some(s => s.includes('afternoon') || s.includes('crash')),
      muscleTension:    all.some(s => s.includes('muscle') || s.includes('tension')),
      headaches:        all.some(s => s.includes('head')),
    },
    profile: {
      age,
      isMale:       /male|man/i.test(sex) && !/female/i.test(sex),
      diabetes:     /type.?2.diabet|diabetes/.test(condStr),
      cognitionLow: qScore.domains.cognition.wellness < 50,
    },
    safetyFlags: new Set(safetyFlags),
    phase,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Phase-aware action strings
// ─────────────────────────────────────────────────────────────────────────────

function phasedWalk(phase: Phase): string {
  if (phase === 'foundation') return '15-minute brisk walk'
  if (phase === 'build')      return '25-minute brisk walk'
  return '30-minute brisk walk'
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Rules
// ─────────────────────────────────────────────────────────────────────────────

type TaskBase = Omit<PlannedTask, 'isKeystone'>

interface MoveRule {
  priority: number
  id: string
  check: (ctx: MoveContext) => boolean
  build: (ctx: MoveContext) => TaskBase
}

const RULES: MoveRule[] = [

  // ── P1: Completely inactive + lab finding ───────────────────────────────

  {
    priority: 5, id: 'mv_pers_inactive_homa',
    check: ctx =>
      ctx.completelyInactive &&
      (isWatch(ctx.lab.homaIR.tier) || isWatch(ctx.lab.glucose.tier)),
    build: ctx => ({
      interventionId: 'mv_pers_inactive_homa', pillar: 'Move',
      title: '10-minute walk after your next meal',
      dailyAction: `You don't exercise currently and HOMA-IR is ${fmt(ctx.lab.homaIR.value)} — a 10-minute walk within 30 minutes of your largest meal is the single most targeted exercise for insulin sensitivity`,
      detail: 'Put on shoes immediately after eating. A gentle pace is enough — it\'s the timing that matters, not the intensity.',
      evidenceGrade: 'strong', sourceFindingIds: ['insufficient_activity', 'insulin_resistance'],
      rationale: 'Post-meal walking blunts the glucose spike at the most vulnerable window; even 10 minutes started within 30 min of eating is measurably effective.',
      personalisation: `You currently do no regular exercise and HOMA-IR is ${fmt(ctx.lab.homaIR.value)} (${isWatch(ctx.lab.homaIR.tier) ? 'borderline' : 'out of range'}). Physical activity is the most powerful tool for improving insulin sensitivity — post-meal timing makes it even more targeted.`,
    }),
  },

  {
    priority: 6, id: 'mv_pers_inactive_no_lab',
    check: ctx =>
      ctx.completelyInactive &&
      !isWatch(ctx.lab.homaIR.tier) &&
      !isWatch(ctx.lab.glucose.tier) &&
      !ctx.symptoms.lowMotivation,
    build: () => ({
      interventionId: 'mv_pers_inactive_no_lab', pillar: 'Move',
      title: '10 minutes of walking — start today',
      dailyAction: 'You currently don\'t do regular exercise — today\'s task is just 10 minutes. Any walk, any pace. A 10-minute daily walk is associated with 18% lower all-cause mortality in prospective studies',
      detail: 'Walk to anywhere — the park, the shop, around the block. You don\'t need equipment or a plan. Just 10 minutes.',
      evidenceGrade: 'moderate', sourceFindingIds: ['insufficient_activity'],
      rationale: 'Even small amounts of physical activity have disproportionate benefits in completely inactive individuals; the first step is the most important.',
      personalisation: 'Your EVS responses show you currently do no regular exercise. The health benefit of going from zero to any activity is larger than any subsequent improvement — this is the highest-leverage moment to start.',
    }),
  },

  {
    priority: 7, id: 'mv_pers_inactive_motivation',
    check: ctx => ctx.completelyInactive && ctx.symptoms.lowMotivation,
    build: () => ({
      interventionId: 'mv_pers_inactive_motivation', pillar: 'Move',
      title: '5 minutes of movement — just start',
      dailyAction: 'You reported low motivation and don\'t currently exercise — the motivation to move comes from moving, not the other way around. Today: 5 minutes. That\'s it. Start there',
      detail: 'Walk outside or around the room for 5 minutes. Don\'t set a bigger goal. The only task is starting.',
      evidenceGrade: 'moderate', sourceFindingIds: ['insufficient_activity'],
      rationale: 'Exercise reliably improves mood and motivation within minutes; the barrier is initiation. The "just 5 minutes" approach bypasses the motivational barrier by making the ask small enough to do immediately.',
      personalisation: 'You reported low motivation and your activity level is zero. Inactivity itself suppresses motivation through reduced dopamine and endorphin tone — movement is both the treatment and the goal here. Five minutes lowers the barrier to starting.',
    }),
  },

  // ── P2: Low active + lab finding ───────────────────────────────────────

  {
    priority: 10, id: 'mv_pers_low_homa',
    check: ctx =>
      !ctx.completelyInactive &&
      ctx.isLowActive &&
      isWatch(ctx.lab.homaIR.tier),
    build: ctx => ({
      interventionId: 'mv_pers_low_homa', pillar: 'Move',
      title: 'Post-meal walk — insulin sensitivity priority',
      dailyAction: `HOMA-IR at ${fmt(ctx.lab.homaIR.value)} — a 10-minute walk within 30 minutes of your largest meal blunts the glucose spike. You get ${ctx.mvpaMinPerWeek} min/week; the timing of this walk adds impact beyond the total`,
      detail: 'Start walking within 30 minutes of eating. A gentle pace counts. This is the most targeted exercise timing for insulin sensitivity.',
      evidenceGrade: 'strong', sourceFindingIds: ['insulin_resistance'],
      rationale: 'Post-meal exercise redirects circulating glucose into muscle; even low intensity is highly effective when timed correctly after meals.',
      personalisation: `You exercise ${ctx.mvpaMinPerWeek} min/week (below the 150 min target) and HOMA-IR is ${fmt(ctx.lab.homaIR.value)} (${isWatch(ctx.lab.homaIR.tier) ? 'borderline' : 'out of range'}). Post-meal walking is specifically effective for insulin resistance because it blunts the glucose spike at the moment it occurs.`,
    }),
  },

  {
    priority: 11, id: 'mv_pers_low_lipids',
    check: ctx =>
      ctx.isLowActive &&
      isWatch(ctx.lab.nonHDL.tier),
    build: ctx => ({
      interventionId: 'mv_pers_low_lipids', pillar: 'Move',
      title: `${phasedWalk(ctx.phase)} — lipid priority`,
      dailyAction: `Non-HDL at ${fmt(ctx.lab.nonHDL.value, 0)} mg/dL and ${ctx.mvpaMinPerWeek} min/week of activity — aerobic exercise raises HDL and lowers triglycerides. A ${phasedWalk(ctx.phase)} today is your most targeted Move intervention for your lipid profile`,
      detail: 'Brisk enough to breathe harder but still able to hold a conversation. Build the habit and the lab numbers follow.',
      evidenceGrade: 'strong', sourceFindingIds: ['dyslipidemia'],
      rationale: 'Aerobic exercise raises HDL cholesterol and lowers triglycerides; effects are dose-dependent and begin with the first session.',
      personalisation: `Non-HDL is ${fmt(ctx.lab.nonHDL.value, 0)} mg/dL (${isWatch(ctx.lab.nonHDL.tier) ? 'borderline' : 'out of range'}) and you exercise ${ctx.mvpaMinPerWeek} min/week vs the 150 min target. Aerobic activity is a first-line intervention for lipid management — the gap to 150 min/week is your most impactful change.`,
    }),
  },

  // ── P3: Sedentary + lab ─────────────────────────────────────────────────

  {
    priority: 15, id: 'mv_pers_sedentary_homa',
    check: ctx =>
      ctx.verySedentary &&
      isWatch(ctx.lab.homaIR.tier),
    build: ctx => ({
      interventionId: 'mv_pers_sedentary_homa', pillar: 'Move',
      title: '2-minute walk every hour — insulin priority',
      dailyAction: `You sit for ${ctx.sittingHours} hours/day and HOMA-IR is ${fmt(ctx.lab.homaIR.value)} — breaking sitting every hour with a 2-minute walk reverses postprandial glucose elevation that accumulates over a long day`,
      detail: 'Set an hourly timer. Stand, walk to the water cooler, or step outside. Two minutes is enough to interrupt the metabolic impact of prolonged sitting.',
      evidenceGrade: 'moderate', sourceFindingIds: ['insulin_resistance'],
      rationale: 'Hourly movement breaks interrupt the postprandial glucose plateau that builds during prolonged sitting; cumulative effects over a day are measurable.',
      personalisation: `You sit for ${ctx.sittingHours} hours/day (above 10 hours = very sedentary) and HOMA-IR is ${fmt(ctx.lab.homaIR.value)} (borderline). Prolonged uninterrupted sitting raises insulin resistance independently of total exercise — hourly breaks specifically address this.`,
    }),
  },

  // ── P4: Strength gap ───────────────────────────────────────────────────

  {
    priority: 20, id: 'mv_pers_strength_age',
    check: ctx =>
      ctx.strengthGap &&
      ctx.profile.age !== null &&
      ctx.profile.age >= 45,
    build: ctx => ({
      interventionId: 'mv_pers_strength_age', pillar: 'Move',
      title: 'Strength session — most important at your age',
      dailyAction: `You do ${ctx.strengthDays} strength session${ctx.strengthDays === 1 ? '' : 's'}/week (target: 2) and are ${ctx.profile.age} — after 45, muscle loss accelerates to ~1%/year without resistance work. Today: squats, wall push-ups, and calf raises. 10 minutes is enough to start`,
      detail: 'Squats (10 reps), wall push-ups (10 reps), calf raises (15 reps) — 2 rounds. No equipment needed. The goal is to do it, not to maximise intensity.',
      evidenceGrade: 'strong', sourceFindingIds: ['insufficient_activity'],
      rationale: 'Resistance training preserves muscle mass and bone density; the protective effect is strongest when started before significant loss has occurred — after 40–45 is the most impactful window.',
      personalisation: `You do ${ctx.strengthDays === 0 ? 'no' : `only ${ctx.strengthDays}`} strength training per week and are ${ctx.profile.age} years old. Muscle mass declines at ~1%/year after 45 without resistance training — this is the highest-leverage Move habit for your age.`,
    }),
  },

  {
    priority: 21, id: 'mv_pers_strength_testosterone',
    check: ctx =>
      ctx.strengthGap &&
      ctx.profile.isMale &&
      isWatch(ctx.lab.testosterone.tier),
    build: ctx => ({
      interventionId: 'mv_pers_strength_testosterone', pillar: 'Move',
      title: 'Strength session — testosterone support',
      dailyAction: `Testosterone is borderline and you do ${ctx.strengthDays === 0 ? 'no' : `${ctx.strengthDays}`} strength training — resistance exercise is the most evidence-based natural intervention for testosterone support. A bodyweight session today matters`,
      detail: 'Compound movements work best: squats, lunges, push-ups, rows. Even 10–15 minutes of full-body resistance work triggers the hormonal response.',
      evidenceGrade: 'moderate', sourceFindingIds: ['low_testosterone_men'],
      rationale: 'Resistance training acutely raises testosterone and, over time with adequate sleep and body composition, supports baseline testosterone levels.',
      personalisation: `Testosterone is borderline and you do ${ctx.strengthDays === 0 ? 'no' : `${ctx.strengthDays}`} strength sessions/week. Resistance training is the most evidence-backed lifestyle intervention for testosterone support — compound movements that load large muscle groups have the strongest effect.`,
    }),
  },

  // ── P5: Symptom bridges ────────────────────────────────────────────────

  {
    priority: 25, id: 'mv_pers_crashes_walk',
    check: ctx =>
      ctx.symptoms.afternoonCrashes &&
      !ctx.meetsAerobic,
    build: ctx => ({
      interventionId: 'mv_pers_crashes_walk', pillar: 'Move',
      title: 'Post-lunch walk — afternoon crash fix',
      dailyAction: `You report afternoon crashes and get ${ctx.mvpaMinPerWeek} min/week of exercise. A 10-minute walk after lunch targets the energy dip more reliably than caffeine — try it today`,
      detail: 'Walk outside after your midday meal. Movement redirects blood flow, clears adenosine, and triggers a natural energy uptick within 10–15 minutes.',
      evidenceGrade: 'moderate', sourceFindingIds: ['insufficient_activity'],
      rationale: 'Post-meal movement reduces the glucose spike that causes the subsequent postprandial dip; walking after lunch specifically prevents the 2–3 pm energy crash.',
      personalisation: `You reported afternoon energy crashes and exercise ${ctx.mvpaMinPerWeek} min/week (below target). The afternoon crash is partly driven by a glucose-insulin cycle after lunch — a 10-minute walk after eating blunts the glucose spike and prevents the dip.`,
    }),
  },

  {
    priority: 26, id: 'mv_pers_tension_stretch',
    check: ctx => ctx.symptoms.muscleTension,
    build: () => ({
      interventionId: 'mv_pers_tension_stretch', pillar: 'Move',
      title: '5-minute morning stretch — muscle tension',
      dailyAction: 'You reported muscle tension — a daily 5-minute stretch routine is the most targeted first step. Neck, shoulders, chest, hip flexors, and lower back. Do it before checking your phone',
      detail: 'Neck rolls (5 each side), shoulder circles, chest stretch against a door frame, standing hip flexor stretch (30 sec each side), cat-cow for the lower back.',
      evidenceGrade: 'moderate', sourceFindingIds: ['insufficient_activity'],
      rationale: 'Regular stretching reduces muscle tension by improving fascial mobility and reducing chronic low-grade contraction patterns driven by prolonged sitting.',
      personalisation: 'You reported muscle tension as a recurring symptom. Regular gentle movement and stretching is the most effective non-pharmacological approach — daily 5-minute routines are more effective than occasional longer sessions because consistency matters more than duration.',
    }),
  },

  {
    priority: 27, id: 'mv_pers_cognition_walk',
    check: ctx => ctx.profile.cognitionLow && !ctx.meetsAerobic,
    build: ctx => ({
      interventionId: 'mv_pers_cognition_walk', pillar: 'Move',
      title: 'Walk for your brain — cognitive priority',
      dailyAction: `Your cognition score is below average and you exercise ${ctx.mvpaMinPerWeek} min/week — a 20-minute aerobic walk improves working memory for 2–3 hours after. Today\'s Move task is also a brain task`,
      detail: 'Brisk pace — enough to raise your heart rate slightly. The cognitive effect comes from the aerobic component, not the distance.',
      evidenceGrade: 'moderate', sourceFindingIds: ['insufficient_activity'],
      rationale: 'A single bout of aerobic exercise improves executive function and working memory within 20 minutes; with regular practice, it increases BDNF and promotes neuroplasticity.',
      personalisation: `Your PROMIS Cognition score is below average and you exercise ${ctx.mvpaMinPerWeek} min/week. Physical activity is one of the most evidence-backed interventions for cognitive function — a 20-minute aerobic walk specifically improves working memory and concentration for several hours.`,
    }),
  },

  // ── P6: Close to target ────────────────────────────────────────────────

  {
    priority: 30, id: 'mv_pers_close_to_target',
    check: ctx => ctx.closeToAeroTarget,
    build: ctx => ({
      interventionId: 'mv_pers_close_to_target', pillar: 'Move',
      title: `One more session — ${ctx.aeroGapMinutes} minutes to the guideline`,
      dailyAction: `You're at ${ctx.mvpaMinPerWeek} min/week — only ${ctx.aeroGapMinutes} minutes from the WHO 150-minute target. One more ${phasedWalk(ctx.phase)} this week closes the gap`,
      detail: 'You\'re close. A single extra session this week moves you from "below guidelines" to meeting them.',
      evidenceGrade: 'strong', sourceFindingIds: ['insufficient_activity'],
      rationale: 'The health benefits of meeting (vs. not meeting) the 150 min/week aerobic guideline are substantial; the marginal value of crossing the threshold is disproportionately high.',
      personalisation: `You exercise ${ctx.mvpaMinPerWeek} min/week — just ${ctx.aeroGapMinutes} minutes below the WHO 150-minute minimum. The health difference between 100 and 150 min/week is significant; you're close enough that one extra session this week crosses it.`,
    }),
  },

  // ── P7: Meets aerobic, strength gap ────────────────────────────────────

  {
    priority: 35, id: 'mv_pers_aerobic_strength_gap',
    check: ctx => ctx.meetsAerobic && ctx.strengthGap,
    build: ctx => ({
      interventionId: 'mv_pers_aerobic_strength_gap', pillar: 'Move',
      title: 'Strength session — your only remaining gap',
      dailyAction: `You meet the aerobic guideline (${ctx.mvpaMinPerWeek} min/week) — well done. Strength training ${ctx.strengthDays === 0 ? 'is entirely missing' : `is at ${ctx.strengthDays}/week (target: 2)`}. A session today closes your only movement gap`,
      detail: 'Squats, lunges, push-ups, and rows — major muscle groups. Even a 15-minute full-body session is enough to meet the guideline.',
      evidenceGrade: 'strong', sourceFindingIds: ['insufficient_activity'],
      rationale: 'WHO 2020 guidelines require both aerobic AND strength training for full health benefit; the two have complementary and largely non-overlapping effects on metabolic health and longevity.',
      personalisation: `You're meeting the WHO aerobic guideline (${ctx.mvpaMinPerWeek} min/week) but strength training is ${ctx.strengthDays === 0 ? 'absent' : `below the 2-day target (${ctx.strengthDays}/week)`}. Strength training adds benefits that aerobic exercise cannot: muscle preservation, bone density, and insulin sensitivity improvements that compound over years.`,
    }),
  },

  // ── P8: High sedentary alone ────────────────────────────────────────────

  {
    priority: 40, id: 'mv_pers_sedentary_alone',
    check: ctx => ctx.highSedentary && !ctx.verySedentary,
    build: ctx => ({
      interventionId: 'mv_pers_sedentary_alone', pillar: 'Move',
      title: 'Sitting break every hour',
      dailyAction: `You sit for ${ctx.sittingHours} hours/day — breaking every hour with a 2–3 minute walk interrupts the postprandial glucose plateau and improves afternoon circulation`,
      detail: 'Set an hourly timer during desk time. Walk to water, outside, or around the room. Two minutes is enough.',
      evidenceGrade: 'moderate', sourceFindingIds: ['insufficient_activity'],
      rationale: 'Interrupting prolonged sitting improves post-meal glucose and microvascular circulation; effects are independent of total exercise volume.',
      personalisation: `You sit for ${ctx.sittingHours} hours/day (above the 8-hour sedentary threshold). Prolonged uninterrupted sitting raises glucose and inflammatory markers independently of whether you exercise — hourly breaks are the most effective way to address sedentary metabolism.`,
    }),
  },

  // ── P9: Diabetes condition ──────────────────────────────────────────────

  {
    priority: 45, id: 'mv_pers_diabetes_postmeal',
    check: ctx => ctx.profile.diabetes,
    build: ctx => ({
      interventionId: 'mv_pers_diabetes_postmeal', pillar: 'Move',
      title: 'Post-meal walk — diabetes management priority',
      dailyAction: 'With type 2 diabetes, the post-meal walk is your most targeted Move intervention — it blunts the glucose spike at the moment it matters most. 10 minutes within 30 minutes of your largest meal',
      detail: 'Gentle pace is fine. The timing within 30 minutes of eating is what makes this effective — muscle contraction redirects glucose without needing insulin.',
      evidenceGrade: 'strong', sourceFindingIds: ['diabetes_risk', 'insulin_resistance'],
      rationale: 'Post-meal exercise activates GLUT4 glucose transporters in muscle independently of insulin; this is especially important in type 2 diabetes where insulin signalling is impaired.',
      personalisation: `You have type 2 diabetes recorded as a condition and currently exercise ${ctx.mvpaMinPerWeek} min/week. Post-meal walking is particularly powerful with diabetes because it activates glucose uptake in muscle through a pathway that bypasses insulin resistance — the most targeted exercise strategy for your condition.`,
    }),
  },

  // ── P10: General low activity fallback ────────────────────────────────

  {
    priority: 50, id: 'mv_pers_general_walk',
    check: ctx => !ctx.meetsAerobic && !ctx.completelyInactive,
    build: ctx => ({
      interventionId: 'mv_pers_general_walk', pillar: 'Move',
      title: `${phasedWalk(ctx.phase)} — building toward the target`,
      dailyAction: `You're at ${ctx.mvpaMinPerWeek} min/week vs the 150-minute target (${ctx.aeroGapMinutes} min to go). Today: a ${phasedWalk(ctx.phase)} brings you closer`,
      detail: 'Brisk enough to breathe slightly harder. The target is 150 min/week spread across most days — consistency beats intensity.',
      evidenceGrade: 'strong', sourceFindingIds: ['insufficient_activity'],
      rationale: 'WHO 2020 guidelines: 150–300 min/week of moderate aerobic activity reduces all-cause mortality, CVD, diabetes, and depression risk by 20–35%.',
      personalisation: `Your EVS score shows ${ctx.mvpaMinPerWeek} min/week of aerobic activity — ${Math.round((ctx.mvpaMinPerWeek / 150) * 100)}% of the 150-minute WHO minimum. Regular aerobic activity is one of the most evidence-backed investments in long-term health across all conditions.`,
    }),
  },

  {
    priority: 55, id: 'mv_pers_maintenance',
    check: ctx => ctx.meetsAerobic && ctx.meetsStrength,
    build: ctx => ({
      interventionId: 'mv_pers_maintenance', pillar: 'Move',
      title: 'Maintain your movement routine',
      dailyAction: `You're meeting both WHO movement guidelines (aerobic + strength). Today: a ${phasedWalk(ctx.phase)} or your usual session maintains what you've built`,
      detail: 'Meeting the guidelines is the goal — today is about consistency, not progression.',
      evidenceGrade: 'strong', sourceFindingIds: [],
      rationale: 'Maintaining both aerobic and strength training at guideline levels is associated with the lowest all-cause mortality risk across major cohort studies.',
      personalisation: `You meet both the aerobic (${ctx.mvpaMinPerWeek} min/week) and strength (${ctx.strengthDays} days/week) WHO guidelines. Consistency is what converts short-term fitness into long-term health protection.`,
    }),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 4. Builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildMoveTasks(
  ctx: MoveContext,
  phase: Phase,
  maxTasks = 1,
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
