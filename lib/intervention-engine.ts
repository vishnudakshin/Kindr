// lib/intervention-engine.ts
//
// Layer 5 v2 — intervention engine.
// Implements deriveSafetyFlags + buildDailyPlanV2 per the spec in
// references/kindr_intervention_engine_spec.md (§6 safety gate, §7 algorithm).
//
// Deterministic given (date, state): same inputs → same daily plan.
// An empty state array (fresh user) is valid and produces a well-formed plan.

import type { FindingsResult } from './findings'
import type { HistoryResponses, PlanBaselines } from './types'
import type {
  SafetyFlag, Phase, InterventionPillar, EvidenceGrade,
  UserInterventionState, HabitProgress, DailyPlanInput, DailyPlanV2, PlannedTask,
  FindingInterventionLink, Intervention, DietaryRequirement, DifficultyTier,
  DEFAULT_SELECTION_CONFIG,
} from './intervention-schema'
import { DEFAULT_SELECTION_CONFIG as DEFAULT_CONFIG } from './intervention-schema'
import { INTERVENTION_LIBRARY, INTERVENTION_MAP } from './intervention-library'
import { buildNourishContext, buildNourishTasks } from './nourish-engine'
import { buildCalmContext, buildCalmTasks } from './calm-engine'
import { buildMoveContext, buildMoveTasks } from './move-engine'

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

const GRADE_WEIGHT: Record<EvidenceGrade, number> = { strong: 1.0, moderate: 0.7, emerging: 0.4 }

// ─────────────────────────────────────────────────────────────────────────
// Phase
// ─────────────────────────────────────────────────────────────────────────

export function phaseFor(dayOffset: number): Phase {
  if (dayOffset <= 14) return 'foundation'
  if (dayOffset <= 42) return 'build'
  return 'consolidate'
}

// ─────────────────────────────────────────────────────────────────────────
// Deterministic hash & shuffle
// ─────────────────────────────────────────────────────────────────────────

function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function makePrng(seed: number): () => number {
  let s = seed
  return () => {
    s ^= s << 13
    s ^= s >> 17
    s ^= s << 5
    return (s >>> 0) / 0x100000000
  }
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  const rand = makePrng(seed)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─────────────────────────────────────────────────────────────────────────
// Safety flags (spec §6)
// ─────────────────────────────────────────────────────────────────────────

export function deriveSafetyFlags(
  findings: FindingsResult,
  history: HistoryResponses,
): SafetyFlag[] {
  const flags = new Set<SafetyFlag>()

  for (const f of findings.findings) {
    if (f.refer) flags.add('referral_open')
    switch (f.id) {
      case 'iron_deficiency':
        if (f.severity !== 'info') flags.add('anemia')
        break
      case 'anemia_inflammatory':
        flags.add('anemia')
        break
      case 'electrolyte':
        flags.add('electrolyte_abnormal')
        break
      case 'kidney_function':
        flags.add('ckd')
        break
    }
  }

  const sbp = history.bpSystolic
  const dbp = history.bpDiastolic
  if ((sbp != null && sbp >= 180) || (dbp != null && dbp >= 110)) {
    flags.add('uncontrolled_htn')
  }

  const condStr = [
    ...(history.conditions ?? []),
    history.conditionsOther ?? '',
  ].join(' ').toLowerCase()
  if (/heart.attack|myocardial|stroke|angina|coronary|cardiac/.test(condStr)) {
    flags.add('cardiac_redflag')
  }

  const medStr = [
    history.medications ?? '',
    history.medicationsText ?? '',
  ].join(' ').toLowerCase()
  if (/\binsulin\b/.test(medStr)) flags.add('on_insulin')
  if (/warfarin|coumadin|xarelto|apixaban|dabigatran|rivaroxaban|eliquis|anticoagulant/.test(medStr)) {
    flags.add('anticoagulant')
  }

  return [...flags]
}

// ─────────────────────────────────────────────────────────────────────────
// Dietary exclusions (spec §2b, §11)
// ─────────────────────────────────────────────────────────────────────────

export function deriveDietaryExclusions(
  history: HistoryResponses,
): { excludedRequirements: DietaryRequirement[]; allergens: string[] } {
  const excluded = new Set<DietaryRequirement>()
  const diets = history.dietaryPreferences ?? []

  const isVeg = diets.some(d => /vegetarian|vegan/i.test(d))
  const isVegan = diets.some(d => /vegan/i.test(d))

  if (isVeg) {
    excluded.add('meat')
    excluded.add('fish')
  }
  if (isVegan) {
    excluded.add('egg')
    excluded.add('dairy')
    excluded.add('animal_protein')
  }

  const allergenText = [history.allergies ?? '', history.allergiesText ?? ''].join(' ').toLowerCase()
  const allergens = allergenText.split(/[\s,;]+/).filter(t => t.length > 1)

  return { excludedRequirements: [...excluded], allergens }
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function daysBetween(earlier: string, later: string): number {
  return Math.round(
    (new Date(later).getTime() - new Date(earlier).getTime()) / 86_400_000,
  )
}

function inCooldown(
  st: UserInterventionState | undefined,
  today: string,
  cooldownDays: number,
  isKeystone: boolean,
): boolean {
  if (isKeystone) return false
  if (!st?.lastShown) return false
  const daysAgo = daysBetween(st.lastShown, today)
  return daysAgo >= 0 && daysAgo <= cooldownDays
}

function scoreCandidate(
  link: FindingInterventionLink,
  findingPriority: number,
  relevanceMultiplier = 1,
): number {
  const iv = INTERVENTION_LIBRARY[link.interventionId]
  if (!iv) return 0
  const grade = link.grade ?? iv.evidence.grade
  return findingPriority * link.relevance * relevanceMultiplier * GRADE_WEIGHT[grade]
}

function resolveDailyAction(
  iv: Intervention,
  phase: Phase,
  baselines: PlanBaselines,
  difficulty: DifficultyTier,
): string {
  if (!iv.dose.ladder || iv.dose.ladder.length === 0) return iv.title

  // Phase index: 0=foundation, 1=build, 2=consolidate
  const PHASE_IDX: Record<Phase, number> = { foundation: 0, build: 1, consolidate: 2 }
  let idx = PHASE_IDX[phase]

  // Difficulty shifts the rung: gentle → softer, ambitious → harder
  if (difficulty === 'gentle') idx = Math.max(0, idx - 1)
  if (difficulty === 'ambitious') idx = Math.min(iv.dose.ladder.length - 1, idx + 1)

  // Baseline clamp: if baseline is low, hold at foundation
  if (iv.dose.baselineKey) {
    const baselineVal = baselines[iv.dose.baselineKey]
    if (baselineVal === null || baselineVal === 0) idx = 0
  }

  // Find the rung at the clamped phase index
  const phases: Phase[] = ['foundation', 'build', 'consolidate']
  const targetPhase = phases[idx]
  const rung = iv.dose.ladder.find(r => r.phase === targetPhase)
  return (rung ?? iv.dose.ladder[0]).dailyAction
}

// Pick the variant in a rotation group shown least recently.
function pickLeastRecent(
  ids: string[],
  stateMap: Map<string, UserInterventionState>,
  seed: number,
): string {
  const rand = makePrng(seed)
  return [...ids].sort((a, b) => {
    const sa = stateMap.get(a)?.lastShown ?? null
    const sb = stateMap.get(b)?.lastShown ?? null
    if (!sa && !sb) return rand() - 0.5
    if (!sa) return -1
    if (!sb) return 1
    return sa < sb ? -1 : sa > sb ? 1 : rand() - 0.5
  })[0]
}

// ─────────────────────────────────────────────────────────────────────────
// Supplement anchor (always a keystone, built from findings + history)
// ─────────────────────────────────────────────────────────────────────────

function buildSupplementTask(
  findings: FindingsResult,
  history: HistoryResponses,
): PlannedTask {
  const findingIds = new Set(findings.findings.map(f => f.id))

  const supplements: string[] = ['B complex', 'Zinc', 'Omega-3']

  if (findingIds.has('vitamin_d_low'))  supplements.push('Vitamin D3 + K2')
  if (findingIds.has('magnesium_low'))  supplements.push('Magnesium')

  const bowelIrregular =
    history.bowelStatus && history.bowelStatus !== 'Regular'
  if (bowelIrregular) supplements.push('Probiotics')

  return {
    interventionId: 'nr_supplements_daily',
    pillar: 'Nourish',
    title: 'Daily supplements',
    dailyAction: 'Take your daily supplements',
    detail: `${supplements.join(', ')}. Take with your largest meal for best absorption.`,
    evidenceGrade: 'moderate',
    isKeystone: true,
    sourceFindingIds: findings.findings.map(f => f.id),
    rationale:
      'Targeted supplementation fills micronutrient gaps that diet alone cannot reliably address — especially B complex, zinc, and omega-3 for metabolic and inflammatory health.',
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Main engine (spec §7)
// ─────────────────────────────────────────────────────────────────────────

interface MergedCandidate {
  ivId: string
  score: number
  sourceFindingIds: string[]
  state?: UserInterventionState
}

export function buildDailyPlanV2(input: DailyPlanInput): DailyPlanV2 {
  const {
    findings,
    history,
    baselines,
    preferences,
    interventionState,
    habitProgress,
    cycleStartDate,
    today,
    priorOutcomes = [],
    config: cfg = DEFAULT_CONFIG,
    nutrition,
    symptoms,
    activity,
    dietLog,
    labInterp,
    questionnaireScore,
    stress: stressRaw,
    sleep:  sleepRaw,
    wellbeing: wellbeingRaw,
  } = input

  const phase = phaseFor(Math.max(0, daysBetween(cycleStartDate, today)))
  const flags = deriveSafetyFlags(findings, history)
  const flagSet = new Set(flags)

  const { excludedRequirements, allergens: userAllergens } = deriveDietaryExclusions(history)

  const seed = hashSeed(`kindr|${today}`)

  // State lookups
  const stateMap = new Map<string, UserInterventionState>(
    interventionState.map(s => [s.interventionId, s]),
  )
  const habitMap = new Map<string, HabitProgress>(
    habitProgress.map(h => [h.habitKey, h]),
  )

  // Prior-outcome relevance adjustments (n-of-1 reweighting)
  const relAdj = new Map<string, number>()
  for (const o of priorOutcomes) {
    for (const ivId of o.interventionIds) {
      if (o.markerDirection === 'improved' && o.adherence >= 0.7) {
        relAdj.set(ivId, (relAdj.get(ivId) ?? 1) * 1.2)
      } else if (o.markerDirection === 'unchanged' && o.adherence >= 0.7) {
        relAdj.set(ivId, (relAdj.get(ivId) ?? 1) * 0.7)
      }
    }
  }

  // ── 1. CANDIDATES ────────────────────────────────────────────────────

  interface RawCandidate {
    ivId: string
    findingId: string
    findingPriority: number
    link: FindingInterventionLink
  }

  const rawCandidates: RawCandidate[] = []
  for (const finding of findings.findings) {
    const links = INTERVENTION_MAP[finding.id] ?? []
    for (const link of links) {
      if (INTERVENTION_LIBRARY[link.interventionId]) {
        rawCandidates.push({
          ivId: link.interventionId,
          findingId: finding.id,
          findingPriority: finding.priority,
          link,
        })
      }
    }
  }

  // ── 2. SAFETY ─────────────────────────────────────────────────────────

  const safeRaw: RawCandidate[] = []
  for (const c of rawCandidates) {
    const iv = INTERVENTION_LIBRARY[c.ivId]!
    const blocked = iv.contraindications.some(f => flagSet.has(f))

    if (blocked) {
      let fbId = iv.fallbackId
      while (fbId) {
        const fb = INTERVENTION_LIBRARY[fbId]
        if (!fb) break
        if (!fb.contraindications.some(f => flagSet.has(f))) {
          safeRaw.push({ ...c, ivId: fbId, link: { ...c.link, interventionId: fbId } })
          break
        }
        fbId = fb.fallbackId
      }
      continue
    }
    safeRaw.push(c)
  }

  // Gentle-cap: referral_open → Move lane limited to gentle
  const safeFiltered = safeRaw.filter(c => {
    if (!flagSet.has('referral_open')) return true
    const iv = INTERVENTION_LIBRARY[c.ivId]!
    return iv.pillar !== 'Move' || iv.intensity === 'gentle'
  })

  // ── 2b. DIETARY EXCLUSIONS ────────────────────────────────────────────

  const dietFiltered = safeFiltered.filter(c => {
    const iv = INTERVENTION_LIBRARY[c.ivId]!
    if (iv.requires?.some(r => excludedRequirements.includes(r))) return false
    if (iv.allergens?.some(a => userAllergens.some(ua => ua.includes(a.toLowerCase())))) return false
    return true
  })

  // ── 3. DEDUPE + SYNERGY ───────────────────────────────────────────────

  const grouped = new Map<string, { score: number; sourceFindingIds: string[] }>()
  for (const c of dietFiltered) {
    const multiplier = relAdj.get(c.ivId) ?? 1
    const s = scoreCandidate(c.link, c.findingPriority, multiplier)
    const existing = grouped.get(c.ivId)
    if (!existing) {
      grouped.set(c.ivId, { score: s, sourceFindingIds: [c.findingId] })
    } else {
      existing.score += s
      if (!existing.sourceFindingIds.includes(c.findingId)) {
        existing.sourceFindingIds.push(c.findingId)
      }
    }
  }

  const merged: MergedCandidate[] = []
  for (const [ivId, g] of grouped) {
    const n = g.sourceFindingIds.length
    const synergyBoosted = g.score * (1 + cfg.synergyBoostPerExtraFinding * (n - 1))
    merged.push({
      ivId,
      score: synergyBoosted,
      sourceFindingIds: g.sourceFindingIds,
      state: stateMap.get(ivId),
    })
  }

  // ── 4. STATE FILTER ───────────────────────────────────────────────────

  // Rotation groups: suppress all but least-recently-seen variant per group
  const rotGroupMembers = new Map<string, string[]>()
  for (const m of merged) {
    const iv = INTERVENTION_LIBRARY[m.ivId]!
    if (iv.rotationGroup) {
      const members = rotGroupMembers.get(iv.rotationGroup) ?? []
      members.push(m.ivId)
      rotGroupMembers.set(iv.rotationGroup, members)
    }
  }

  const suppressedByRotation = new Set<string>()
  for (const [, ids] of rotGroupMembers) {
    if (ids.length <= 1) continue
    const chosen = pickLeastRecent(ids, stateMap, seed)
    for (const id of ids) {
      if (id !== chosen) suppressedByRotation.add(id)
    }
  }

  const eligible = merged.filter(m => {
    if (suppressedByRotation.has(m.ivId)) return false
    const iv = INTERVENTION_LIBRARY[m.ivId]!
    const habitKey = iv.rotationGroup ?? iv.id
    const hp = habitMap.get(habitKey)
    if (hp?.status === 'retired') return false
    return !inCooldown(stateMap.get(m.ivId), today, cfg.cooldownDays, iv.keystoneEligible ?? false)
  })

  eligible.sort((a, b) => b.score - a.score)

  // ── 5. KEYSTONES — 1 per pillar + supplement anchor ───────────────────
  // Keystones bypass rotation-group suppression (they repeat daily by design).
  // Search in `merged` (pre-suppression) sorted by score, filtering only for
  // retired habits and keystone eligibility. Cooldown is also bypassed for keystones.

  const keystonePool = [...merged]
    .filter(m => {
      const iv = INTERVENTION_LIBRARY[m.ivId]!
      if (!iv.keystoneEligible) return false
      const habitKey = iv.rotationGroup ?? iv.id
      return habitMap.get(habitKey)?.status !== 'retired'
    })
    .sort((a, b) => b.score - a.score)

  const PILLAR_ORDER: InterventionPillar[] = ['Move', 'Nourish', 'Calm']
  const keystonePicked: MergedCandidate[] = []
  for (const pillar of PILLAR_ORDER) {
    const best = keystonePool.find(
      m => INTERVENTION_LIBRARY[m.ivId]?.pillar === pillar,
    )
    if (best) keystonePicked.push(best)
  }
  const keystoneIds = new Set(keystonePicked.map(m => m.ivId))

  // ── 6. ROTATING ───────────────────────────────────────────────────────

  const keystoneFindings = new Set(keystonePicked.flatMap(m => m.sourceFindingIds))
  const topFindingIds = findings.findings.slice(0, 2).map(f => f.id)
  const guaranteedFirst: MergedCandidate[] = []
  for (const fid of topFindingIds) {
    if (keystoneFindings.has(fid)) continue
    const rep = eligible.find(
      m => !keystoneIds.has(m.ivId) && m.sourceFindingIds.includes(fid),
    )
    if (rep) guaranteedFirst.push(rep)
  }
  const guaranteedIds = new Set(guaranteedFirst.map(m => m.ivId))

  const rotatingPool: MergedCandidate[] = [
    ...guaranteedFirst,
    ...seededShuffle(
      eligible.filter(m => !keystoneIds.has(m.ivId) && !guaranteedIds.has(m.ivId)),
      seed,
    ),
  ]

  const supplementTask = buildSupplementTask(findings, history)
  const remainingSlots = cfg.maxHabitTasks - keystonePicked.length - 1
  const maxPerLane = cfg.maxPerLane

  const usedLanes = new Map<InterventionPillar, number>()
  const usedConflictGroups = new Set<string>()
  let totalEffort = 0
  let newCount = 0
  const rotatingPicked: MergedCandidate[] = []

  for (const m of rotatingPool) {
    if (rotatingPicked.length >= remainingSlots) break
    const iv = INTERVENTION_LIBRARY[m.ivId]!
    const lane = iv.pillar
    const laneCount = usedLanes.get(lane) ?? 0
    if (laneCount >= maxPerLane) continue
    if (iv.conflictGroup && usedConflictGroups.has(iv.conflictGroup)) continue
    if (totalEffort + iv.effort > cfg.effortCeiling) continue
    const isNew = !m.state?.lastShown
    if (isNew && newCount >= cfg.maxNewPerDay) continue

    rotatingPicked.push(m)
    usedLanes.set(lane, laneCount + 1)
    if (iv.conflictGroup) usedConflictGroups.add(iv.conflictGroup)
    totalEffort += iv.effort
    if (isNew) newCount++
  }

  // ── ASSEMBLE ──────────────────────────────────────────────────────────

  function toTask(m: MergedCandidate, isKeystone: boolean): PlannedTask {
    const iv = INTERVENTION_LIBRARY[m.ivId]!
    return {
      interventionId: m.ivId,
      pillar: iv.pillar,
      title: iv.title,
      dailyAction: resolveDailyAction(iv, phase, baselines, preferences.difficulty),
      detail: iv.detail,
      evidenceGrade: iv.evidence.grade,
      isKeystone,
      sourceFindingIds: [...new Set(m.sourceFindingIds)],
      rationale: iv.evidence.note,
    }
  }

  let keystones: PlannedTask[] = [
    ...keystonePicked.map(m => toTask(m, true)),
    supplementTask,
  ]
  let rotating = rotatingPicked.map(m => toTask(m, false))

  // ── PILLAR PERSONALISATION — replace generic rotating tasks with
  //    data-driven ones when questionnaire / lab / diet data is available. ─────

  // Nourish (up to 2 rotating tasks)
  if (labInterp && nutrition && symptoms && activity) {
    const nourishCtx = buildNourishContext(
      labInterp,
      history,
      nutrition,
      symptoms,
      activity,
      dietLog ?? null,
      flags,
      excludedRequirements,
    )
    const personalised = buildNourishTasks(nourishCtx, phase, cfg.maxPerLane)
    if (personalised.length > 0) {
      keystones = keystones.filter(
        t => t.pillar !== 'Nourish' || t.interventionId === 'nr_supplements_daily',
      )
      rotating = [...rotating.filter(t => t.pillar !== 'Nourish'), ...personalised]
    }
  }

  // Calm (1 rotating task — capped to avoid cognitive overload)
  if (questionnaireScore && stressRaw && sleepRaw && wellbeingRaw && symptoms && activity && labInterp) {
    const calmCtx = buildCalmContext(
      questionnaireScore,
      stressRaw,
      sleepRaw,
      wellbeingRaw,
      symptoms,
      activity,
      labInterp,
      flags,
      history.age ?? null,
      history.mentalHealth ?? '',
    )
    const personalisedCalm = buildCalmTasks(calmCtx, phase, 1)
    if (personalisedCalm.length > 0) {
      rotating = [...rotating.filter(t => t.pillar !== 'Calm'), ...personalisedCalm]
    }
  }

  // Move (1 rotating task — capped to avoid cognitive overload)
  if (questionnaireScore && activity && symptoms && labInterp) {
    const moveCtx = buildMoveContext(
      questionnaireScore,
      activity,
      symptoms,
      labInterp,
      flags,
      phase,
      history.age ?? null,
      history.sex ?? '',
      history.conditions ?? [],
    )
    const personalisedMove = buildMoveTasks(moveCtx, phase, 1)
    if (personalisedMove.length > 0) {
      rotating = [...rotating.filter(t => t.pillar !== 'Move'), ...personalisedMove]
    }
  }

  const byPillar: Record<InterventionPillar, PlannedTask[]> = {
    Nourish: [], Calm: [], Move: [],
  }
  for (const t of [...keystones, ...rotating]) {
    byPillar[t.pillar].push(t)
  }

  return {
    date: today,
    phase,
    keystones,
    rotating,
    byPillar,
    totalHabitTasks: keystones.length + rotating.length,
    appliedSafetyFlags: flags,
    appliedDietaryExclusions: excludedRequirements,
  }
}
