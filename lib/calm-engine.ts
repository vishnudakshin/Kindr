// lib/calm-engine.ts
//
// Personalized Calm task generator. Fuses PSS-10 sub-themes (stress pattern),
// PROMIS Sleep Disturbance item-level analysis, WHO-5 wellbeing sub-items, AUDIT-C,
// cortisol/CRP lab values, and symptom flags into one targeted Calm task per day.

import type { StressResponses, SleepResponses, WellbeingResponses, SymptomsResponses, ActivityResponses, QuestionnaireScore } from './types'
import type { LabInterpretation, BiomarkerTier } from './lab-interpretation'
import type { SafetyFlag, Phase, PlannedTask } from './intervention-schema'
import { labVal, isWatch, fmt, type LabVal } from './nourish-engine'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Sub-theme derivation
// ─────────────────────────────────────────────────────────────────────────────

interface StressSubThemes {
  severe: boolean        // wellness < 30
  elevated: boolean      // wellness < 50
  rawScore: number       // PSS-10 total 0–40
  overwhelm: boolean     // items[9] >= 3  ("difficulties piling up")
  anxious: boolean       // items[2] >= 3  ("nervous or stressed")
  lossOfControl: boolean // items[0,8] >= 3 ("upset by uncontrollable things")
  lowConfidence: boolean // items[3,6] <= 1 (reverse-scored: low raw = rarely felt confident)
}

interface SleepSubThemes {
  severe: boolean          // PROMIS T >= 65
  disturbedFlag: boolean   // PROMIS T >= 60
  tScore: number
  onsetProblem: boolean    // items[2,3] >= 4 (difficulty falling asleep)
  restless: boolean        // items[4] >= 4
  notRefreshing: boolean   // items[1,7] >= 4 (not feeling rested — reversed scale)
  sleepAnxiety: boolean    // items[5,6] >= 4 (worried about sleep)
  poorQuality: boolean     // items[0] >= 4
}

interface WellbeingSubThemes {
  low: boolean            // wellness < 50
  depressionScreen: boolean
  lowMood: boolean        // items[0] <= 1 ("rarely cheerful")
  notCalm: boolean        // items[1] <= 1 ("rarely calm/relaxed")
  lowEnergy: boolean      // items[2] <= 1 ("rarely active/vigorous")
  notRested: boolean      // items[3] <= 1 ("rarely woke fresh")
  lowMeaning: boolean     // items[4] <= 1 ("daily life rarely interesting")
}

function deriveStress(qScore: QuestionnaireScore, raw: StressResponses): StressSubThemes {
  const d = qScore.domains.stress
  const items = raw.items
  return {
    severe:        d.wellness < 30,
    elevated:      d.wellness < 50,
    rawScore:      d.raw,
    overwhelm:     (items[9] ?? 0) >= 3,
    anxious:       (items[2] ?? 0) >= 3,
    lossOfControl: (items[0] ?? 0) >= 3 || (items[8] ?? 0) >= 3,
    lowConfidence: (items[3] ?? 4) <= 1 || (items[6] ?? 4) <= 1,
  }
}

function deriveSleep(qScore: QuestionnaireScore, raw: SleepResponses): SleepSubThemes {
  const d = qScore.domains.sleep
  const t = (d.meta?.['tScore'] as number) ?? 50
  const items = raw.items
  return {
    severe:        t >= 65,
    disturbedFlag: t >= 60,
    tScore:        t,
    onsetProblem:  (items[2] ?? 1) >= 4 || (items[3] ?? 1) >= 4,
    restless:      (items[4] ?? 1) >= 4,
    notRefreshing: (items[1] ?? 1) >= 4 || (items[7] ?? 1) >= 4,
    sleepAnxiety:  (items[5] ?? 1) >= 4 || (items[6] ?? 1) >= 4,
    poorQuality:   (items[0] ?? 1) >= 4,
  }
}

function deriveWellbeing(qScore: QuestionnaireScore, raw: WellbeingResponses): WellbeingSubThemes {
  const d = qScore.domains.wellbeing
  const items = raw.items
  return {
    low:             d.wellness < 50,
    depressionScreen: d.flags.includes('depression_screen_positive'),
    lowMood:         (items[0] ?? 5) <= 1,
    notCalm:         (items[1] ?? 5) <= 1,
    lowEnergy:       (items[2] ?? 5) <= 1,
    notRested:       (items[3] ?? 5) <= 1,
    lowMeaning:      (items[4] ?? 5) <= 1,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CalmContext
// ─────────────────────────────────────────────────────────────────────────────

export interface CalmContext {
  stress: StressSubThemes
  sleep: SleepSubThemes
  wellbeing: WellbeingSubThemes
  alcohol: { riskFlag: boolean; raw: number }
  lab: { cortisol: LabVal; hsCRP: LabVal; dheas: LabVal }
  symptoms: {
    irritability: boolean
    anxiousThoughts: boolean
    overwhelmed: boolean
    lowMotivation: boolean
  }
  profile: {
    sittingHours: number
    age: number | null
    mentalHealthFlag: boolean
  }
  safetyFlags: Set<SafetyFlag>
}

export function buildCalmContext(
  qScore: QuestionnaireScore,
  stressRaw: StressResponses,
  sleepRaw: SleepResponses,
  wellbeingRaw: WellbeingResponses,
  symptoms: SymptomsResponses,
  activity: ActivityResponses,
  labInterp: LabInterpretation,
  safetyFlags: SafetyFlag[],
  age: number | null,
  mentalHealthCondition: string,
): CalmContext {
  const all = [
    ...symptoms.physical.map(s => s.toLowerCase()),
    ...symptoms.energyMood.map(s => s.toLowerCase()),
  ]
  return {
    stress:    deriveStress(qScore, stressRaw),
    sleep:     deriveSleep(qScore, sleepRaw),
    wellbeing: deriveWellbeing(qScore, wellbeingRaw),
    alcohol: {
      riskFlag: qScore.alcohol.riskFlag,
      raw:      qScore.alcohol.raw,
    },
    lab: {
      cortisol: labVal(labInterp, 'Morning Cortisol'),
      hsCRP:    labVal(labInterp, 'hs-CRP'),
      dheas:    labVal(labInterp, 'DHEA-S'),
    },
    symptoms: {
      irritability:    all.some(s => s.includes('irritab')),
      anxiousThoughts: all.some(s => s.includes('anxious') || s.includes('anxiety')),
      overwhelmed:     all.some(s => s.includes('overwhelm')),
      lowMotivation:   all.some(s => s.includes('motivation')),
    },
    profile: {
      sittingHours: activity.sittingHours,
      age,
      mentalHealthFlag: /^yes$/i.test(mentalHealthCondition.trim()),
    },
    safetyFlags: new Set(safetyFlags),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Rules
// ─────────────────────────────────────────────────────────────────────────────

type TaskBase = Omit<PlannedTask, 'isKeystone'>

interface CalmRule {
  priority: number
  id: string
  check: (ctx: CalmContext) => boolean
  build: (ctx: CalmContext) => TaskBase
}

const RULES: CalmRule[] = [

  // ── Sleep: severe disturbance — sub-theme specific ──────────────────────

  {
    priority: 5, id: 'cl_pers_sleep_severe_onset',
    check: ctx => ctx.sleep.severe && ctx.sleep.onsetProblem,
    build: ctx => ({
      interventionId: 'cl_pers_sleep_severe_onset', pillar: 'Calm',
      title: 'Screens off 30 minutes before bed',
      dailyAction: `PROMIS sleep score is in the severe range (T=${Math.round(ctx.sleep.tScore)}) and you specifically report trouble falling asleep — removing screens 30 min before bed is the most targeted change for sleep onset`,
      detail: 'No phone, tablet, or TV for 30 minutes before your target bedtime. Read a physical book or listen to calm music instead.',
      evidenceGrade: 'moderate', sourceFindingIds: ['poor_sleep'],
      rationale: 'Evening screen light suppresses melatonin and delays sleep onset; the effect is strongest in the hour before sleep.',
      personalisation: `Your PROMIS Sleep Disturbance T-score is ${Math.round(ctx.sleep.tScore)} (T≥65 = severe range) and your responses specifically show significant difficulty falling asleep. Screens before bed is the most evidence-backed single change for this exact sleep pattern.`,
    }),
  },

  {
    priority: 6, id: 'cl_pers_sleep_severe_anxiety',
    check: ctx => ctx.sleep.severe && ctx.sleep.sleepAnxiety,
    build: ctx => ({
      interventionId: 'cl_pers_sleep_severe_anxiety', pillar: 'Calm',
      title: 'Keep a consistent wake time — even after a bad night',
      dailyAction: `Severe sleep disturbance (T=${Math.round(ctx.sleep.tScore)}) with significant sleep anxiety — a fixed wake time, even after a poor night, is the most powerful CBT-I technique for breaking the worry-sleep cycle`,
      detail: 'Set one wake time and hold it regardless of when you fell asleep. This rebuilds sleep pressure and reduces sleep anxiety over 1–2 weeks.',
      evidenceGrade: 'strong', sourceFindingIds: ['poor_sleep'],
      rationale: 'Stimulus control and consistent wake time are the most evidence-backed interventions in CBT for Insomnia (CBT-I), the gold-standard treatment for sleep anxiety.',
      personalisation: `Your PROMIS T-score is ${Math.round(ctx.sleep.tScore)} (severe range) and you report significant worry about not being able to sleep. Sleep anxiety creates a feedback loop that makes sleep harder — consistent wake timing is the primary CBT-I tool to interrupt it.`,
    }),
  },

  {
    priority: 7, id: 'cl_pers_sleep_severe_alcohol',
    check: ctx => ctx.sleep.severe && ctx.sleep.restless && ctx.alcohol.riskFlag,
    build: ctx => ({
      interventionId: 'cl_pers_sleep_severe_alcohol', pillar: 'Calm',
      title: 'Alcohol-free night — for your sleep',
      dailyAction: `Severe sleep disturbance (T=${Math.round(ctx.sleep.tScore)}) + restless sleep + alcohol above low-risk — alcohol suppresses REM sleep and causes rebound restlessness in the second half of the night`,
      detail: 'An alcohol-free night directly improves sleep depth and reduces restlessness. The effect is measurable in a single night.',
      evidenceGrade: 'strong', sourceFindingIds: ['poor_sleep', 'risky_alcohol'],
      rationale: 'Alcohol fragments sleep architecture: it sedates at first but causes rebound arousal in the second half of the night, specifically reducing REM and slow-wave sleep.',
      personalisation: `Your sleep disturbance score is severe (T=${Math.round(ctx.sleep.tScore)}), you report restless sleep, and your AUDIT-C score shows regular alcohol use — alcohol directly causes the restless pattern you're experiencing by disrupting the second half of sleep.`,
    }),
  },

  // ── Sleep: moderate-severe disturbance — sub-theme specific ────────────

  {
    priority: 10, id: 'cl_pers_sleep_notrefreshing',
    check: ctx => ctx.sleep.disturbedFlag && ctx.sleep.notRefreshing && !ctx.sleep.severe,
    build: ctx => ({
      interventionId: 'cl_pers_sleep_notrefreshing', pillar: 'Calm',
      title: 'Wind-down routine for restorative sleep',
      dailyAction: `PROMIS T=${Math.round(ctx.sleep.tScore)} and sleep isn't leaving you refreshed — a 30-minute wind-down routine is the most impactful first step for restorative sleep`,
      detail: 'Dim the lights, step away from screens and work, and do something genuinely calming. The consistency matters more than what you do.',
      evidenceGrade: 'moderate', sourceFindingIds: ['poor_sleep'],
      rationale: 'A consistent wind-down supports the evening fall in cortisol and arousal, allowing deeper, more restorative sleep phases.',
      personalisation: `Your PROMIS Sleep T-score is ${Math.round(ctx.sleep.tScore)} (elevated) and you specifically report sleep that doesn't leave you feeling refreshed. A wind-down routine addresses the arousal that prevents deep, slow-wave sleep.`,
    }),
  },

  {
    priority: 11, id: 'cl_pers_sleep_restless',
    check: ctx => ctx.sleep.disturbedFlag && ctx.sleep.restless,
    build: ctx => ({
      interventionId: 'cl_pers_sleep_restless', pillar: 'Calm',
      title: 'Caffeine cutoff at 3 pm — for restless sleep',
      dailyAction: `Sleep disturbance (T=${Math.round(ctx.sleep.tScore)}) + restless sleep — caffeine after 3 pm disrupts sleep continuity even when you fall asleep fine. No caffeine after 3 pm today`,
      detail: 'Caffeine has a half-life of ~5 hours. A 3 pm coffee still has 50% of its stimulant effect at 8 pm, fragmenting sleep in the first half of the night.',
      evidenceGrade: 'moderate', sourceFindingIds: ['poor_sleep'],
      rationale: 'Caffeine blocks adenosine receptors; late intake reduces slow-wave sleep and increases fragmentation even when sleep onset feels normal.',
      personalisation: `Your PROMIS T-score is ${Math.round(ctx.sleep.tScore)} and you report restless sleep. Caffeine's 5-hour half-life means an afternoon coffee is still active at bedtime — this is a direct and addressable cause of sleep continuity disruption.`,
    }),
  },

  {
    priority: 12, id: 'cl_pers_sleep_alcohol',
    check: ctx => ctx.sleep.disturbedFlag && ctx.alcohol.riskFlag,
    build: ctx => ({
      interventionId: 'cl_pers_sleep_alcohol', pillar: 'Calm',
      title: 'Alcohol-free night — sleep comes first',
      dailyAction: `Sleep is disturbed (T=${Math.round(ctx.sleep.tScore)}) and alcohol use is above the low-risk threshold — alcohol reduces deep sleep and REM. An alcohol-free night directly improves how restored you feel tomorrow`,
      detail: 'Alcohol sedates but fragments sleep: you may fall asleep faster but wake more in the second half of the night.',
      evidenceGrade: 'strong', sourceFindingIds: ['poor_sleep', 'risky_alcohol'],
      rationale: 'Alcohol suppresses REM sleep and slow-wave sleep; regular use creates a cycle of poor sleep quality even when total sleep time is adequate.',
      personalisation: `Your sleep disturbance score is elevated (T=${Math.round(ctx.sleep.tScore)}) and your AUDIT-C score shows alcohol use above low-risk levels — alcohol is one of the most potent suppressors of REM and deep sleep, directly worsening the sleep quality you're experiencing.`,
    }),
  },

  // ── Stress: severe — sub-theme specific ────────────────────────────────

  {
    priority: 20, id: 'cl_pers_stress_severe_overwhelm',
    check: ctx => ctx.stress.severe && ctx.stress.overwhelm,
    build: ctx => ({
      interventionId: 'cl_pers_stress_severe_overwhelm', pillar: 'Calm',
      title: 'Take a 10-minute restorative break — now',
      dailyAction: `PSS-10 in the high-stress range (${ctx.stress.rawScore}/40) + feeling overwhelmed by difficulties — a phone-free, 10-minute break is the quickest evidence-backed nervous-system reset available`,
      detail: 'Step away from the screen and the task. Walk, breathe slowly, or sit somewhere quiet. The break itself is the task — don\'t multitask during it.',
      evidenceGrade: 'moderate', sourceFindingIds: ['high_stress'],
      rationale: 'Restorative breaks interrupt the stress-arousal cycle; even brief recovery periods lower cortisol and restore attentional capacity.',
      personalisation: `Your PSS-10 score is ${ctx.stress.rawScore}/40 (high-stress range) and you specifically report feeling like difficulties are piling up beyond control. Overwhelm raises cortisol and narrows attention — a brief restorative break is the fastest physiological reset.`,
    }),
  },

  {
    priority: 21, id: 'cl_pers_stress_severe_control',
    check: ctx => ctx.stress.severe && ctx.stress.lossOfControl,
    build: ctx => ({
      interventionId: 'cl_pers_stress_severe_control', pillar: 'Calm',
      title: '3 minutes of slow breathing — right now',
      dailyAction: `High stress (PSS-10: ${ctx.stress.rawScore}/40) with a pattern of feeling upset by things outside your control — 4 counts in, 6 counts out, 3 minutes. This is your most targeted nervous-system intervention`,
      detail: 'Sit comfortably. Breathe in for 4 slow counts, out for 6. Repeat until 3 minutes are done. The extended exhale activates the vagus nerve.',
      evidenceGrade: 'moderate', sourceFindingIds: ['high_stress'],
      rationale: 'Slow breathing at ~6 breaths/min raises heart-rate variability (HRV) and activates the parasympathetic system; the extended exhale specifically triggers the vagal brake.',
      personalisation: `Your PSS-10 score is ${ctx.stress.rawScore}/40 (high-stress range) and your responses show a pattern of feeling upset by things outside your control. This specific stress pattern responds best to physiological calming — slow breathing directly engages the vagal brake that lowers arousal.`,
    }),
  },

  // ── Stress: elevated — sub-theme and lab bridges ───────────────────────

  {
    priority: 25, id: 'cl_pers_stress_cortisol',
    check: ctx => ctx.stress.elevated && isWatch(ctx.lab.cortisol.tier),
    build: ctx => ({
      interventionId: 'cl_pers_stress_cortisol', pillar: 'Calm',
      title: '10 minutes of morning sunlight — cortisol regulator',
      dailyAction: `Elevated stress (PSS-10: ${ctx.stress.rawScore}/40) + borderline cortisol${ctx.lab.cortisol.value !== null ? ` (${fmt(ctx.lab.cortisol.value)} µg/dL)` : ''} — morning sunlight is the most effective natural cortisol rhythm regulator`,
      detail: 'Step outside within 1 hour of waking — a chai on the balcony counts. Natural light triggers the healthy morning cortisol peak and helps it fall by evening.',
      evidenceGrade: 'moderate', sourceFindingIds: ['adrenal_stress', 'high_stress'],
      rationale: 'Morning light anchors the circadian cortisol rhythm; a well-timed peak supports energy and alertness, and a proper evening fall supports sleep.',
      personalisation: `Your PSS-10 stress score is ${ctx.stress.rawScore}/40 (elevated) and Morning Cortisol is ${fmt(ctx.lab.cortisol.value)} µg/dL (${isWatch(ctx.lab.cortisol.tier) ? 'borderline' : 'out of range'}). Stress and cortisol dysregulation reinforce each other — morning sunlight is the most direct environmental lever on the cortisol cycle.`,
    }),
  },

  {
    priority: 26, id: 'cl_pers_stress_anxious',
    check: ctx => ctx.stress.elevated && ctx.stress.anxious,
    build: ctx => ({
      interventionId: 'cl_pers_stress_anxious', pillar: 'Calm',
      title: '3 minutes of slow breathing — your daily Calm anchor',
      dailyAction: `You frequently feel nervous or stressed (PSS-10: ${ctx.stress.rawScore}/40) — 3 minutes of 4-in, 6-out breathing is your most targeted daily nervous-system intervention`,
      detail: 'Inhale for 4 counts, exhale for 6. Do this before a meal, at your desk, or anywhere. The longer exhale is what activates the calming response.',
      evidenceGrade: 'moderate', sourceFindingIds: ['high_stress'],
      rationale: 'Slow breathing at ~6 breaths/min raises HRV, a marker of parasympathetic tone; a brief practice creates measurable calm within minutes.',
      personalisation: `Your PSS-10 score is ${ctx.stress.rawScore}/40 (elevated) and your responses show you frequently feel nervous or stressed — this is the "general anxiety" stress pattern. Slow breathing directly targets the sympathetic activation that drives it.`,
    }),
  },

  {
    priority: 27, id: 'cl_pers_stress_crp',
    check: ctx => ctx.stress.elevated && isWatch(ctx.lab.hsCRP.tier),
    build: ctx => ({
      interventionId: 'cl_pers_stress_crp', pillar: 'Calm',
      title: '5 slow breaths before a meal',
      dailyAction: `Elevated stress (PSS-10: ${ctx.stress.rawScore}/40) + hs-CRP ${fmt(ctx.lab.hsCRP.value)} mg/L — chronic stress drives inflammation. Five breaths before a meal is a low-barrier start to breaking this cycle`,
      detail: 'Take 5 slow breaths before sitting down to eat. It also slows eating pace, which improves satiety signalling.',
      evidenceGrade: 'emerging', sourceFindingIds: ['high_stress', 'inflammation'],
      rationale: 'Stress is a primary driver of systemic inflammation via cortisol and sympathetic signalling; brief daily calming practices reduce inflammatory markers over time.',
      personalisation: `Your PSS-10 score is ${ctx.stress.rawScore}/40 (elevated) and hs-CRP is ${fmt(ctx.lab.hsCRP.value)} mg/L (${isWatch(ctx.lab.hsCRP.tier) ? 'borderline' : 'elevated'}) — chronic stress and inflammation directly amplify each other. This micro-practice targets the stress component of your CRP.`,
    }),
  },

  // ── Wellbeing sub-themes ────────────────────────────────────────────────

  {
    priority: 35, id: 'cl_pers_wellbeing_lowmood',
    check: ctx => ctx.wellbeing.low && ctx.wellbeing.lowMood,
    build: ctx => ({
      interventionId: 'cl_pers_wellbeing_lowmood', pillar: 'Calm',
      title: '15 minutes outdoors — mood lift',
      dailyAction: `WHO-5 wellbeing at ${ctx.wellbeing.low ? 'low' : 'moderate'} with low mood — 15 minutes in green space or daylight improves mood more reliably than almost any other brief activity`,
      detail: 'A park, a tree-lined street, or your garden. The combination of movement, light, and nature is what drives the effect.',
      evidenceGrade: 'moderate', sourceFindingIds: ['low_wellbeing'],
      rationale: 'Time in nature reliably lifts mood and reduces stress hormones; the effect is robust across dozens of studies and populations.',
      personalisation: `Your WHO-5 wellbeing score is in the low range and you report rarely feeling cheerful or in good spirits. Time outdoors in green space is one of the most consistently effective interventions for low mood that doesn't require a formal programme.`,
    }),
  },

  {
    priority: 36, id: 'cl_pers_wellbeing_notcalm',
    check: ctx => ctx.wellbeing.low && ctx.wellbeing.notCalm,
    build: () => ({
      interventionId: 'cl_pers_wellbeing_notcalm', pillar: 'Calm',
      title: '10-minute meditation',
      dailyAction: 'You rarely feel calm or relaxed — a 10-minute guided meditation builds the neural pathways that generate a baseline sense of calm over time',
      detail: 'Use a guided app or simply sit quietly focusing on slow breaths. Consistency matters more than duration.',
      evidenceGrade: 'moderate', sourceFindingIds: ['low_wellbeing'],
      rationale: 'Regular mindfulness meditation reduces anxiety, lowers cortisol, and measurably improves the subjective sense of calm within 4–8 weeks of daily practice.',
      personalisation: 'Your WHO-5 responses show you rarely feel calm or relaxed (item 1 very low). Meditation is the most evidence-backed intervention for building baseline calm — it changes how the brain responds to stressors over time, not just in the moment.',
    }),
  },

  {
    priority: 37, id: 'cl_pers_wellbeing_lowmeaning',
    check: ctx => ctx.wellbeing.low && ctx.wellbeing.lowMeaning,
    build: () => ({
      interventionId: 'cl_pers_wellbeing_lowmeaning', pillar: 'Calm',
      title: 'Reach out to one person today',
      dailyAction: 'Your daily life feels less engaging right now — reaching out to one person you care about is one of the most robust evidence-based interventions for lifting wellbeing',
      detail: 'A voice or video call, not just a text. Connection quality matters more than duration.',
      evidenceGrade: 'moderate', sourceFindingIds: ['low_wellbeing'],
      rationale: 'Social connection is one of the most consistently robust protective factors for wellbeing and longevity across large epidemiological studies.',
      personalisation: 'Your WHO-5 responses show daily life rarely feels interesting or engaging (item 4 very low). Social connection specifically addresses the "meaning" dimension of wellbeing — shared experiences with people we care about are a primary source of meaning.',
    }),
  },

  {
    priority: 38, id: 'cl_pers_wellbeing_depression_screen',
    check: ctx => ctx.wellbeing.depressionScreen,
    build: () => ({
      interventionId: 'cl_pers_wellbeing_depression_screen', pillar: 'Calm',
      title: 'Connect with one person who knows you',
      dailyAction: 'Your wellbeing score is in the low range — reaching out to someone you trust today is a small but meaningful step. You don\'t have to carry this alone',
      detail: 'A friend, family member, or anyone you feel comfortable with. Even a short conversation helps.',
      evidenceGrade: 'moderate', sourceFindingIds: ['low_wellbeing'],
      rationale: 'Social support is protective against low mood; professional support may also be beneficial — your GP or a counsellor can help further.',
      personalisation: 'Your WHO-5 wellbeing score has reached the level where the questionnaire recommends a mental health check-in. Human connection is both an immediate support and a bridge to professional help if needed.',
    }),
  },

  // ── Symptom bridges ─────────────────────────────────────────────────────

  {
    priority: 45, id: 'cl_pers_irritability_breathing',
    check: ctx => ctx.symptoms.irritability && ctx.stress.elevated,
    build: ctx => ({
      interventionId: 'cl_pers_irritability_breathing', pillar: 'Calm',
      title: 'Pause before reacting — 5 breaths',
      dailyAction: `You reported irritability and stress is elevated (PSS-10: ${ctx.stress.rawScore}/40) — five slow breaths before a tense moment or before eating breaks the reactive pattern`,
      detail: 'Take 5 slow breaths at any point in the day when you notice irritability rising. It creates a gap between trigger and response.',
      evidenceGrade: 'emerging', sourceFindingIds: ['high_stress'],
      rationale: 'Brief physiological calming activates the prefrontal cortex, which modulates emotional reactivity; even a few breaths create a measurable pause in the stress-response cycle.',
      personalisation: 'You reported irritability and your PSS-10 stress score is in the elevated range. Irritability is a common manifestation of chronic stress — brief breathing pauses directly target the automatic reactivity pattern.',
    }),
  },

  {
    priority: 46, id: 'cl_pers_anxious_meditation',
    check: ctx => ctx.symptoms.anxiousThoughts && !ctx.stress.elevated,
    build: () => ({
      interventionId: 'cl_pers_anxious_meditation', pillar: 'Calm',
      title: '10 minutes of meditation for anxious thoughts',
      dailyAction: 'You reported anxious thoughts — a 10-minute meditation trains the mind to observe thoughts without being carried away by them',
      detail: 'Focus on slow breaths. When anxious thoughts arise, notice them and return to the breath — that\'s the practice, not a failure.',
      evidenceGrade: 'moderate', sourceFindingIds: ['high_stress'],
      rationale: 'Mindfulness meditation is one of the most evidence-backed interventions for anxiety; meta-analyses show consistent reductions in anxious thought patterns with daily practice.',
      personalisation: 'You reported anxious thoughts as a recurring symptom. Meditation specifically trains the metacognitive skill of observing thoughts without being pulled into them — directly targeting the anxious thought pattern.',
    }),
  },

  // ── Sedentary + stress ─────────────────────────────────────────────────

  {
    priority: 50, id: 'cl_pers_sedentary_stress',
    check: ctx => ctx.profile.sittingHours > 8 && ctx.stress.elevated,
    build: ctx => ({
      interventionId: 'cl_pers_sedentary_stress', pillar: 'Calm',
      title: 'Walk break every hour — for stress and metabolism',
      dailyAction: `You sit for ${ctx.profile.sittingHours} hours/day and stress is elevated (PSS-10: ${ctx.stress.rawScore}/40) — prolonged sitting amplifies cortisol. A 2-minute walk every hour resets both metabolism and stress hormones`,
      detail: 'Set a timer every hour. Stand, walk to the water, or step outside briefly. Two minutes is enough to interrupt the sitting-stress cycle.',
      evidenceGrade: 'moderate', sourceFindingIds: ['high_stress'],
      rationale: 'Prolonged sitting increases cortisol and systemic inflammation; brief hourly movement interruptions counteract both through improved blood flow and adenosine clearance.',
      personalisation: `You sit for ${ctx.profile.sittingHours} hours/day (above the 8-hour sedentary threshold) and your stress score is elevated. Prolonged sitting sustains elevated cortisol — each brief movement break interrupts this cycle.`,
    }),
  },

  // ── Alcohol alone ──────────────────────────────────────────────────────

  {
    priority: 55, id: 'cl_pers_alcohol_dry',
    check: ctx => ctx.alcohol.riskFlag && !ctx.sleep.disturbedFlag && !ctx.stress.elevated,
    build: () => ({
      interventionId: 'cl_pers_alcohol_dry', pillar: 'Calm',
      title: 'Make today alcohol-free',
      dailyAction: 'Your alcohol pattern is above the low-risk threshold — 2 dry days/week is the single most impactful change. Today is a good day to be dry',
      detail: 'Dry days give the liver a recovery window and improve sleep quality even without other changes.',
      evidenceGrade: 'strong', sourceFindingIds: ['risky_alcohol'],
      rationale: 'Regular alcohol-free days reduce liver enzyme burden, improve sleep architecture, and lower long-term cardiovascular risk.',
      personalisation: 'Your AUDIT-C score shows alcohol intake above the low-risk threshold. Two dry days per week is the most consistent recommendation for reducing alcohol-related health risk without requiring abstinence.',
    }),
  },

  // ── Generic fallbacks ─────────────────────────────────────────────────

  {
    priority: 60, id: 'cl_pers_sleep_generic',
    check: ctx => ctx.sleep.disturbedFlag,
    build: ctx => ({
      interventionId: 'cl_pers_sleep_generic', pillar: 'Calm',
      title: 'Consistent bedtime tonight',
      dailyAction: `Sleep is disturbed (PROMIS T=${Math.round(ctx.sleep.tScore)}) — pick a bedtime and start winding down 30 minutes before. A consistent schedule is the single most impactful sleep habit`,
      detail: 'The wind-down can be anything calm: dim lights, no work, gentle stretching or reading.',
      evidenceGrade: 'moderate', sourceFindingIds: ['poor_sleep'],
      rationale: 'A regular sleep-wake schedule stabilises the circadian rhythm and builds sleep pressure, the two most powerful regulators of sleep quality.',
      personalisation: `Your PROMIS Sleep Disturbance T-score is ${Math.round(ctx.sleep.tScore)} (T≥60 = elevated). Consistent sleep timing is the single most impactful behavioural change for sleep quality and is the foundation of all sleep therapy.`,
    }),
  },

  {
    priority: 61, id: 'cl_pers_stress_generic',
    check: ctx => ctx.stress.elevated,
    build: ctx => ({
      interventionId: 'cl_pers_stress_generic', pillar: 'Calm',
      title: '3 minutes of slow breathing',
      dailyAction: `Stress score is ${ctx.stress.rawScore}/40 — 3 minutes of 4-in, 6-out breathing is your daily Calm anchor. It works within minutes and compounds over time`,
      detail: 'Find a quiet moment — before a meal, after sitting down at your desk, or before bed.',
      evidenceGrade: 'moderate', sourceFindingIds: ['high_stress'],
      rationale: 'Slow breathing at ~6 breaths/min raises HRV (parasympathetic tone) and lowers cortisol; consistent daily practice builds resilience over weeks.',
      personalisation: `Your PSS-10 stress score is ${ctx.stress.rawScore}/40 — the population average is ~13/40, and scores ≥27 indicate high perceived stress. Daily slow breathing is the most accessible and evidence-backed Calm intervention.`,
    }),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 4. Builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildCalmTasks(
  ctx: CalmContext,
  _phase: Phase,
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
