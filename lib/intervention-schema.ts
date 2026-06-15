// lib/intervention-schema.ts
//
// CONTRACT / SCHEMA for the rule-based intervention engine (plan tab v2).
// This file defines the data model and function signatures only — no selection logic. It is the
// interface Claude Code builds the engine against. The algorithm itself is specified as pseudocode in
// references/kindr_intervention_engine_spec.md.

import type { FindingsResult } from './findings'
import type {
  HistoryResponses, PlanBaselines, NutritionResponses, SymptomsResponses, ActivityResponses,
  DietLog, StressResponses, SleepResponses, WellbeingResponses, QuestionnaireScore,
} from './types'
import type { LabInterpretation } from './lab-interpretation'

// ─────────────────────────────────────────────────────────────────────────
// 1. Taxonomy
// ─────────────────────────────────────────────────────────────────────────

// Three plan lanes. Sleep interventions live under Calm (sleep hygiene, wind-down, daylight).
// Clinical findings (rechecks, referrals) are NOT plan tasks here — they surface in the report's
// triage banner instead, so there is no lab-follow-up lane.
export type InterventionPillar = 'Nourish' | 'Calm' | 'Move'

// Evidence grade rubric (see spec §4): strong = guideline / meta-analysis of RCTs; moderate =
// consistent RCT or strong observational; emerging = mechanistic or early-trial.
export type EvidenceGrade = 'strong' | 'moderate' | 'emerging'

export type Intensity = 'gentle' | 'moderate' | 'vigorous'
export type Effort = 1 | 2 | 3                    // user burden, for daily-load balancing
export type Phase = 'foundation' | 'build' | 'consolidate' // 90-day cycle phases (see spec §5)
export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

// Every intervention is a DAILY task. Items that should not appear every day (e.g. strength) carry a
// `daysPerWeek` target; the selector spaces those occurrences across the week (see IsScheduledToday).
// There is no weekly/one-off cadence — a "2x/week" goal is simply a daily task scheduled on 2 days.

// ─────────────────────────────────────────────────────────────────────────
// 2. Safety flags — contraindication taxonomy (see spec §6)
// ─────────────────────────────────────────────────────────────────────────
// Derived from engine findings + onboarding. Any intervention whose `contraindications` intersect the
// active flag set is excluded (or substituted via fallbackId). Conservative by default.
export type SafetyFlag =
  | 'anemia'              // low Hb → cap exertion
  | 'cardiac_redflag'     // known CVD / chest-pain symptom / very high BP unmonitored
  | 'uncontrolled_htn'
  | 'electrolyte_abnormal'
  | 'ckd'                 // reduced eGFR → caution with protein/potassium/creatine loads
  | 'hyperkalemia'        // avoid high-potassium pushes
  | 'iron_overload'       // high ferritin without deficiency / hemochromatosis → no iron push
  | 'referral_open'       // an unresolved urgent referral exists → cap exertion intensity to gentle
  | 'pregnancy'
  | 'breastfeeding'
  | 'eating_disorder_risk'// no fasting / restriction / calorie-deficit framing
  | 'on_insulin'          // hypo risk with fasting / heavy exertion timing
  | 'anticoagulant'       // caution with high-dose fish oil / vitamin K swings
  | 'mobility_limited'    // injury / disability → seated or low-impact only
  | 'underweight'         // no calorie-restriction interventions

// ─────────────────────────────────────────────────────────────────────────
// 2b. Dietary exclusions (see spec §6/§11) — real filtering, not just locale bias
// ─────────────────────────────────────────────────────────────────────────
// `requires` lists animal-derived components an intervention depends on; a user's diet pattern maps to
// a set of excluded requirements (vegetarian → meat+fish; vegan → +dairy+egg+animal_protein; etc.) and
// any intervention whose `requires` intersect that set is dropped. `allergens` are matched (case-
// insensitively, substring) against the user's free-text allergies and likewise drop the item.
export type DietaryRequirement = 'meat' | 'fish' | 'egg' | 'dairy' | 'animal_protein'

// ─────────────────────────────────────────────────────────────────────────
// 3. Dosing — target vs daily action vs baseline-aware ladder (see spec §5)
// ─────────────────────────────────────────────────────────────────────────
export interface DoseLadderRung {
  phase: Phase
  dailyAction: string          // the bite shown today, e.g. "2 × 10-min walks"
  daysPerWeek?: number         // optional per-phase frequency override (e.g. strength 1→2→2 days/wk).
                               // Falls back to Intervention.daysPerWeek when omitted.
  weeklyTarget?: string        // optional weekly framing, e.g. "~70 min this week"
}

// Baseline keys the dose ladder can be anchored to. These resolve against PlanBaselines.
export type BaselineKey = 'activityMinutesPerWeek' | 'stepsPerDay'

export interface Dose {
  target: string               // evidence-based goal, e.g. "150 min moderate activity / week"
  metric?: { amount: number; unit: string; per: 'day' | 'week' } // machine-checkable target
  ladder?: DoseLadderRung[]    // progression; selector picks a rung from baseline + phase + difficulty
  baselineKey?: BaselineKey    // signal that sets the starting rung (resolved via PlanBaselines)
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Intervention — one row in the flat library
// ─────────────────────────────────────────────────────────────────────────
export interface Intervention {
  id: string
  pillar: InterventionPillar
  title: string                // specific & dosed: "Walk 150 min/week", not "exercise more"
  detail: string               // how-to
  dose: Dose
  intensity: Intensity
  effort: Effort
  daysPerWeek: number          // 1–7 target days the task surfaces; 7 = every day. The selector spaces
                               // sub-7 items across the week (see IsScheduledToday). Ladder rungs may
                               // override per phase.
  evidence: {
    grade: EvidenceGrade
    note: string               // plain-language rationale ("why this works")
    source?: string            // citation / guideline reference
    reviewed: string           // ISO date the grade was last reviewed (staleness guard)
  }
  contraindications: SafetyFlag[]
  requires?: DietaryRequirement[] // animal-derived dependencies → dietary filter (see §2b)
  allergens?: string[]            // allergen tags matched against the user's allergies (see §2b)
  fallbackId?: string          // gentler substitute used when contraindicated
  rotationGroup?: string       // interchangeable variants share a group (anti-fatigue). Also the
                               // habit identity for streaks/graduation — see habitKeyOf / HabitProgress.
  keystoneEligible?: boolean   // may serve as a repeating daily anchor
  conflictGroup?: string       // at most one per conflictGroup per day (overload control)
  localeTags?: string[]        // e.g. ['IN','vegetarian'] — selection BIAS only, not exclusion (§2b)
  preferredDays?: Weekday[]    // pin the daysPerWeek occurrences to specific weekdays (e.g. weekend);
                               // if omitted, the selector spaces them across the week
}

// Habit identity for streak/graduation tracking: rotating variants (oats → dal) belong to one habit,
// so streaks attach to the rotationGroup when present, else the intervention id.
export type HabitKeyOf = (intervention: Intervention) => string // = rotationGroup ?? id

// ─────────────────────────────────────────────────────────────────────────
// 5. Finding → intervention mapping (many-to-many, with per-finding grade)
// ─────────────────────────────────────────────────────────────────────────
export interface FindingInterventionLink {
  interventionId: string
  relevance: number            // 0..1 weight of this intervention for this finding
  grade?: EvidenceGrade        // per-finding override of the intervention's default grade
}
export type InterventionMap = Record<string /* findingId */, FindingInterventionLink[]>

// ─────────────────────────────────────────────────────────────────────────
// 6. Per-user state — split into variant-level and habit-level (see spec §7,§8,§9)
// ─────────────────────────────────────────────────────────────────────────
export type HabitStatus = 'active' | 'paused' | 'habit_forming' | 'retired'

// Variant-level bookkeeping (per interventionId): drives cooldown and rotation recency — i.e. which
// specific variant was last shown, so the engine can rotate to a fresh one within a group.
export interface UserInterventionState {
  interventionId: string
  lastShown: string | null
  lastCompleted: string | null
}

// Habit-level progress (per habitKey = rotationGroup ?? id): drives graduation (streak ≥ graduateStreak
// → habit_forming) and demotion (consecutiveSkips ≥ demoteSkips → paused). Rotating the variant does
// NOT reset these, because they track the habit, not the wording.
export interface HabitProgress {
  habitKey: string
  status: HabitStatus
  currentStreak: number
  longestStreak: number
  totalCompletions: number
  consecutiveSkips: number
}

// ─────────────────────────────────────────────────────────────────────────
// 6b. User preferences (see spec §8) — extensible; difficulty is the only field for now
// ─────────────────────────────────────────────────────────────────────────
export type DifficultyTier = 'gentle' | 'standard' | 'ambitious'

export interface UserPreferences {
  difficulty: DifficultyTier   // shifts the resolved dose-ladder rung softer/harder (see ResolveDailyAction)
}

// ─────────────────────────────────────────────────────────────────────────
// 6c. Selection tuning (see spec §7,§8,§10) — all dials in one typed place
// ─────────────────────────────────────────────────────────────────────────
export interface SelectionConfig {
  maxHabitTasks: number                 // total daily tasks target (~8)
  keystoneCount: { few: number; many: number } // anchors when there are few vs many findings (2 / 3)
  maxPerLane: number                    // cap per pillar per day (2)
  effortCeiling: number                 // summed-effort ceiling per day (12)
  maxNewPerDay: number                  // never-shown interventions introduced per day (2)
  maxNewPerWeek: number                 // change-rate limit: new habits introduced per week (2)
  cooldownDays: number                  // days an intervention rests after appearing (3)
  graduateStreak: number                // habit streak that flips status → habit_forming (14)
  demoteSkips: number                   // consecutive skips that flip status → paused (3)
  synergyBoostPerExtraFinding: number   // score multiplier per extra source finding (0.15)
}

export const DEFAULT_SELECTION_CONFIG: SelectionConfig = {
  maxHabitTasks: 8,
  keystoneCount: { few: 2, many: 3 },
  maxPerLane: 2,
  effortCeiling: 12,
  maxNewPerDay: 2,
  maxNewPerWeek: 2,
  cooldownDays: 3,
  graduateStreak: 14,
  demoteSkips: 3,
  synergyBoostPerExtraFinding: 0.15,
}

// ─────────────────────────────────────────────────────────────────────────
// 7. Daily plan output
// ─────────────────────────────────────────────────────────────────────────
export interface PlannedTask {
  interventionId: string
  pillar: InterventionPillar
  title: string
  dailyAction: string          // resolved from the dose ladder for today's phase/baseline/difficulty
  detail: string
  evidenceGrade: EvidenceGrade
  isKeystone: boolean
  sourceFindingIds: string[]   // every finding that motivated it (synergy is visible)
  rationale: string            // why this is here today
  personalisation?: string     // data signal that triggered this specific task; shown to the user
}

export interface DailyPlanV2 {
  date: string
  phase: Phase
  keystones: PlannedTask[]            // intentionally-repeating anchors (2–3)
  rotating: PlannedTask[]             // rotating slots (~4–5)
  byPillar: Record<InterventionPillar, PlannedTask[]>
  totalHabitTasks: number
  appliedSafetyFlags: SafetyFlag[]
  appliedDietaryExclusions: DietaryRequirement[] // what the dietary filter removed (transparency)
}

// ─────────────────────────────────────────────────────────────────────────
// 8. Outcome feedback loop — closes the open loop at 90-day reassessment (see spec §9)
// ─────────────────────────────────────────────────────────────────────────
export interface CycleOutcome {
  findingId: string
  interventionIds: string[]
  adherence: number                       // 0..1 completion over the cycle (engagement)
  markerBaseline?: number                 // e.g. ferritin at cycle start
  markerLatest?: number                   // ferritin at reassessment (efficacy)
  markerDirection?: 'improved' | 'unchanged' | 'worsened' | 'unknown'
}

// ─────────────────────────────────────────────────────────────────────────
// 9. Function contracts (signatures only — implemented per spec pseudocode)
// ─────────────────────────────────────────────────────────────────────────
export interface DailyPlanInput {
  findings: FindingsResult
  history: HistoryResponses
  baselines: PlanBaselines                // EVS-derived; sets dose-ladder starting rungs
  preferences: UserPreferences            // difficulty tier (and future prefs)
  interventionState: UserInterventionState[] // variant-level (cooldown / rotation recency)
  habitProgress: HabitProgress[]          // habit-level (streaks / graduation)
  cycleStartDate: string
  today: string
  priorOutcomes?: CycleOutcome[]          // reweights relevance in later cycles (n-of-1)
  config?: SelectionConfig                // defaults to DEFAULT_SELECTION_CONFIG
  // Data-driven Nourish personalisation (optional; falls back to INTERVENTION_MAP when absent)
  nutrition?: NutritionResponses          // STC + AUDIT-C for questionnaire-driven Nourish rules
  symptoms?: SymptomsResponses            // physical/energyMood flags for symptom bridges
  activity?: ActivityResponses            // EVS data needed for TDEE calculation in DietCtx
  dietLog?: DietLog | null                // what the user actually ate today
  labInterp?: LabInterpretation           // full biomarker interpretation for value-referenced tasks
  // Data-driven Calm + Move personalisation
  questionnaireScore?: QuestionnaireScore // pre-computed domain scores (stress, sleep, activity, wellbeing)
  stress?: StressResponses                // PSS-10 raw items for sub-theme analysis
  sleep?: SleepResponses                  // PROMIS sleep raw items for sub-theme analysis
  wellbeing?: WellbeingResponses          // WHO-5 raw items for wellbeing sub-theme analysis
}

export type DeriveSafetyFlags = (findings: FindingsResult, history: HistoryResponses) => SafetyFlag[]

// Derives the diet exclusions to filter on from onboarding.
export type DeriveDietaryExclusions = (
  history: HistoryResponses,
) => { excludedRequirements: DietaryRequirement[]; allergens: string[] }

// True if a (possibly sub-7) intervention should surface today.
export type IsScheduledToday = (
  intervention: Intervention,
  date: string,
) => boolean

export type BuildDailyPlanV2 = (input: DailyPlanInput) => DailyPlanV2
export type ScoreCandidate = (link: FindingInterventionLink, findingPriority: number) => number

// Resolves the daily action string for a dosed intervention.
export type ResolveDailyAction = (
  dose: Dose,
  phase: Phase,
  baselines: PlanBaselines,
  difficulty: DifficultyTier,
) => string

// Hydration is the one computed (non-laddered) dose.
export type ComputeHydrationGlasses = (history: HistoryResponses) => number

// ─────────────────────────────────────────────────────────────────────────
// 10. Persistence row shapes (Supabase; RLS owner-only — see spec §13)
// ─────────────────────────────────────────────────────────────────────────
export interface RowUserInterventionState extends UserInterventionState { user_id: string; updated_at: string }
export interface RowHabitProgress extends HabitProgress { user_id: string; updated_at: string }
export interface RowDailyPlan { user_id: string; date: string; plan: DailyPlanV2 }
export interface RowDailyCompletion { user_id: string; date: string; intervention_id: string; completed: boolean }
export interface RowCycleOutcome extends CycleOutcome { user_id: string; cycle_start: string }
