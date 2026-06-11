// lib/plan.ts
//
// Layer 5: turn the ranked findings into a concrete daily plan of small, repeatable actions, grouped
// into the three habit pillars the user works on — Nourish, Calm, Move. (The engine's fourth pillar,
// Clinical, is a "see a clinician" signal that lives in the report's triage banner, not a daily task.)
//
// Every action carries an `evidence` note grounding it in established research/guidance, so the app can
// surface a "why this works" line and the recommendations are demonstrably evidence-based rather than
// generic wellness advice. Pure and deterministic: findings map to actions via TASK_LIBRARY, ordered by
// priority, deduped, balanced across pillars, and capped. Completion drives the sapling→tree growth,
// which feeds the 90-day grove (see lib/grove.ts).

import type { FindingsResult } from './findings'

export type PlanCategory = 'Nourish' | 'Calm' | 'Move'

export interface PlanTask {
  id: string
  category: PlanCategory
  title: string
  detail: string
  evidence: string                 // plain-language, evidence-based rationale ("why this works")
  sourceFindingId: string | null   // which finding motivated it (null = baseline habit)
}

export interface DailyPlan {
  intro: string
  tasks: PlanTask[]
  byCategory: Record<PlanCategory, PlanTask[]>
  total: number
}

interface TaskSpec { category: PlanCategory; title: string; detail: string; evidence: string }

// Curated keystone actions per finding. Categories match the finding's own pillars.
const TASK_LIBRARY: Record<string, TaskSpec[]> = {
  insulin_resistance: [
    { category: 'Move', title: 'Walk for 10 minutes after your largest meal', detail: 'A short post-meal walk noticeably blunts the glucose spike.',
      evidence: 'Meta-analyses show walking soon after eating lowers the post-meal glucose rise; even ~10 minutes started promptly helps.' },
    { category: 'Nourish', title: 'Build one plate around protein and veg', detail: 'Push refined carbs to the side at a single meal today.',
      evidence: 'Eating protein and fibre alongside carbohydrates slows gastric emptying and flattens the glucose response.' },
  ],
  metabolic_syndrome: [
    { category: 'Move', title: 'Get 20 minutes of brisk movement', detail: 'Daily activity is the strongest single lever on this cluster.',
      evidence: 'WHO recommends 150–300 min/week of moderate activity; it improves insulin sensitivity, blood pressure and lipids together.' },
    { category: 'Nourish', title: 'Swap one sugary drink for water', detail: 'Or unsweetened tea — an easy daily win.',
      evidence: 'Sugar-sweetened drinks are consistently linked to weight gain and higher type-2-diabetes risk.' },
  ],
  diabetes_risk: [
    { category: 'Move', title: 'Take a 15-minute walk', detail: 'Movement now is the most effective prevention there is.',
      evidence: 'Lifestyle programmes built on activity and modest weight loss cut progression to diabetes by ~58% in the Diabetes Prevention Program.' },
    { category: 'Nourish', title: 'Add fibre to breakfast', detail: 'Oats, chia, or fruit eaten with the skin on.',
      evidence: 'Higher dietary fibre intake is reliably associated with lower diabetes and cardiovascular risk.' },
  ],
  dyslipidemia: [
    { category: 'Nourish', title: 'Add a small handful of unsalted nuts', detail: 'A daily source of healthy fats and fibre.',
      evidence: 'Regular nut consumption modestly lowers LDL cholesterol and cardiovascular risk in randomized trials.' },
    { category: 'Move', title: 'Get your heart rate up today', detail: 'A brisk effort raises HDL and lowers triglycerides over time.',
      evidence: 'Aerobic exercise raises HDL and lowers triglycerides; effects build with regular practice.' },
  ],
  cardiometabolic_risk: [
    { category: 'Nourish', title: 'Add soluble fibre to a meal', detail: 'Beans, oats, or an apple help carry cholesterol out.',
      evidence: 'At least 3 g/day of soluble fibre (e.g. oat beta-glucan) lowers LDL by ~5% — a health claim backed by dozens of RCTs.' },
  ],
  apob_ldl_discordance: [
    { category: 'Nourish', title: 'Swap one saturated fat for an unsaturated one', detail: 'e.g. butter for olive oil — lowers particle count over time.',
      evidence: 'Replacing saturated with unsaturated fat lowers LDL cholesterol and ApoB (the atherogenic particle count).' },
  ],
  iron_deficiency: [
    { category: 'Nourish', title: 'Pair an iron-rich food with vitamin C', detail: 'Spinach or lentils with a squeeze of lemon boosts absorption.',
      evidence: 'Vitamin C keeps plant (non-heme) iron in its soluble, absorbable form; a meta-analysis found it meaningfully raises iron absorption.' },
  ],
  b12_folate_low: [
    { category: 'Nourish', title: 'Add a B-vitamin-rich food', detail: 'Eggs, dairy, legumes, or fortified cereals.',
      evidence: 'B12 and folate are required for healthy red cells and nerves; B12 deficiency is common on plant-based diets.' },
  ],
  multi_nutrient_gap: [
    { category: 'Nourish', title: 'Add one colourful whole food to each meal', detail: 'Broad nutrient gaps respond best to variety, not single supplements.',
      evidence: 'Several low micronutrients at once usually reflect intake or absorption; dietary variety addresses the pattern more reliably than isolated pills.' },
  ],
  vitamin_d_low: [
    { category: 'Calm', title: 'Step outside for 10 minutes of daylight', detail: 'Supports vitamin D and steadies your body clock.',
      evidence: 'Sunlight drives vitamin-D synthesis, and morning daylight anchors the circadian rhythm that governs sleep and energy.' },
  ],
  magnesium_low: [
    { category: 'Nourish', title: 'Add a magnesium-rich food', detail: 'Pumpkin seeds, leafy greens, or a square of dark chocolate.',
      evidence: 'Magnesium supports muscle, sleep and glucose metabolism, and a large share of adults fall short of intake targets.' },
  ],
  inflammation: [
    { category: 'Nourish', title: 'Eat oily fish or add ground flaxseed', detail: 'Omega-3s help dial inflammation down.',
      evidence: 'Omega-3 fatty acids have anti-inflammatory effects and can lower CRP.' },
    { category: 'Calm', title: 'Take five slow breaths before a meal', detail: 'A small reset for the stress that feeds inflammation.',
      evidence: 'Chronic stress raises inflammatory signalling; brief relaxation lowers stress reactivity.' },
  ],
  high_stress: [
    { category: 'Calm', title: 'Do three minutes of slow breathing', detail: 'Inhale for 4, exhale for 6 — a few rounds settle the nervous system.',
      evidence: 'Slow breathing near ~6 breaths/min raises heart-rate-variability (vagal) tone and lowers acute stress.' },
  ],
  adrenal_stress: [
    { category: 'Calm', title: 'Protect a 10-minute wind-down', detail: 'A consistent daily pause helps reset the stress response.',
      evidence: 'A regular evening wind-down supports the natural night-time fall in cortisol.' },
  ],
  poor_sleep: [
    { category: 'Calm', title: 'Screens off 30 minutes before bed', detail: 'Dim the lights and let melatonin rise naturally.',
      evidence: 'Evening light — especially short-wavelength screen light — suppresses melatonin and delays sleep onset.' },
    { category: 'Calm', title: 'Keep a consistent wake-up time', detail: 'The single most effective sleep anchor.',
      evidence: 'Regular sleep-wake timing strongly predicts sleep quality and is linked to better metabolic and cardiovascular health.' },
  ],
  low_wellbeing: [
    { category: 'Calm', title: 'Take one real, restorative break', detail: 'A walk, a friend, or anything that genuinely refills you.',
      evidence: 'Brief restorative activity, time outdoors and social connection reliably lift mood.' },
  ],
  insufficient_activity: [
    { category: 'Move', title: 'Add a 15-minute walk', detail: 'The simplest place to start moving more.',
      evidence: 'Even small increases in daily activity are associated with lower all-cause mortality; some movement beats none.' },
  ],
  diet_quality: [
    { category: 'Nourish', title: 'Add a leafy green to one meal', detail: 'Spinach, rocket, or kale — one small handful counts.',
      evidence: 'Higher vegetable intake is linked to lower cardiovascular and metabolic risk.' },
    { category: 'Nourish', title: 'Reduce processed snacks by half', detail: 'Swap one packet snack for nuts or fruit.',
      evidence: 'Higher ultra-processed-food intake is associated with weight gain and metabolic risk; whole-food swaps help.' },
  ],
  risky_alcohol: [
    { category: 'Calm', title: 'Make today alcohol-free', detail: 'A few dry days a week helps your liver, sleep, and mood.',
      evidence: 'Reducing alcohol improves liver enzymes, sleep quality and mood, and lowers long-term health risk.' },
  ],
  liver_stress: [
    { category: 'Nourish', title: 'Cut back on sugary drinks and refined carbs', detail: 'Eases the metabolic load on your liver.',
      evidence: 'Excess sugar and refined carbohydrate drive liver-fat accumulation; cutting back can reverse early fatty-liver change.' },
  ],
  liver_fibrosis_risk: [
    { category: 'Move', title: 'Add 20 minutes of movement', detail: 'Activity directly improves fatty-liver change.',
      evidence: 'Exercise reduces liver fat even without significant weight loss.' },
  ],
  low_testosterone_men: [
    { category: 'Move', title: 'Add a short strength session', detail: 'Even 10 minutes of resistance work supports testosterone.',
      evidence: 'Resistance training, adequate sleep and healthy body weight all support normal testosterone.' },
  ],
}

// Baseline habits used to round out a plan or fill an empty pillar.
const FALLBACK: Record<PlanCategory, TaskSpec[]> = {
  Nourish: [
    { category: 'Nourish', title: 'Drink water through the day', detail: 'A glass on waking and one before each meal.',
      evidence: 'Adequate hydration supports energy, concentration and appetite regulation.' },
    { category: 'Nourish', title: 'Eat a palm of protein at breakfast', detail: 'Steadies energy and appetite for the morning.',
      evidence: 'Protein at breakfast improves satiety and steadies energy across the morning.' },
  ],
  Calm: [
    { category: 'Calm', title: 'Pause for three slow breaths', detail: 'A tiny reset you can do anywhere, anytime.',
      evidence: 'Brief slow breathing activates the parasympathetic "rest" response in moments of stress.' },
    { category: 'Calm', title: 'Step away from screens for 10 minutes', detail: 'Let your attention settle once today.',
      evidence: 'Short attention breaks reduce mental fatigue and perceived stress.' },
  ],
  Move: [
    { category: 'Move', title: 'Stand and stretch every hour', detail: 'Breaks up sitting and keeps you loose.',
      evidence: 'Interrupting prolonged sitting improves post-meal glucose and circulation.' },
    { category: 'Move', title: 'Take a short walk', detail: 'Ten minutes of easy movement counts.',
      evidence: 'Light daily movement counts toward activity targets and supports metabolic health.' },
  ],
}

const CATEGORIES: PlanCategory[] = ['Nourish', 'Calm', 'Move']

export function buildDailyPlan(findings: FindingsResult, opts: { maxTasks?: number } = {}): DailyPlan {
  const max = opts.maxTasks ?? 10
  const tasks: PlanTask[] = []
  const seen = new Set<string>()
  const add = (t: TaskSpec, fid: string | null) => {
    if (seen.has(t.title) || tasks.length >= max) return
    seen.add(t.title)
    tasks.push({ id: `task_${tasks.length + 1}`, category: t.category, title: t.title, detail: t.detail, evidence: t.evidence, sourceFindingId: fid })
  }

  // 1) Curated actions, in finding-priority order.
  for (const f of findings.findings) {
    const lib = TASK_LIBRARY[f.id]
    if (lib) for (const t of lib) add(t, f.id)
  }
  // 2) Guarantee each pillar appears (if room).
  for (const c of CATEGORIES) {
    if (!tasks.some(t => t.category === c)) add(FALLBACK[c][0], null)
  }
  // 3) Round out to a sensible minimum with baseline habits.
  let i = 0
  while (tasks.length < Math.min(max, 6) && i < 30) {
    const c = CATEGORIES[i % 3]
    add(FALLBACK[c][Math.floor(i / 3) % FALLBACK[c].length], null)
    i++
  }

  const byCategory: Record<PlanCategory, PlanTask[]> = { Nourish: [], Calm: [], Move: [] }
  for (const t of tasks) byCategory[t.category].push(t)

  return { intro: 'Small, consistent actions. Tick them off as you go.', tasks, byCategory, total: tasks.length }
}
