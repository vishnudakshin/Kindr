'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { IconSalad, IconChevronRight, IconInfoCircle } from '@tabler/icons-react'
import { BrandHeader } from '@/components/ui/BrandHeader'
import { Button } from '@/components/ui/Button'
import { mockData, saveDietAssessment } from '@/lib/data'
import {
  ACTIVITY_MULTIPLIER, ACTIVITY_LABEL,
  type ActivityLevel, type ProteinTarget, type CarbApproach, type DietaryGoal,
  type DietAssessment,
} from '@/lib/types'

// ── TDEE calculation ──────────────────────────────────────────────────────────

function calcBMR(weightKg: number, heightCm: number, age: number, sex: string): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex.toLowerCase().startsWith('f') ? base - 161 : base + 5
}

const GOAL_MULTIPLIER: Record<DietaryGoal, number> = {
  lose_weight:  0.85,
  maintain:     1.0,
  gain_muscle:  1.10,
}

const PROTEIN_GRAMS_PER_KG: Record<ProteinTarget, number> = {
  standard: 0.8,
  high:     1.6,
  athlete:  2.2,
}

function calcMacros(
  tdee: number,
  weightKg: number,
  protein: ProteinTarget,
  carb: CarbApproach,
): { protein_g: number; carbs_g: number; fat_g: number } {
  const protein_g = Math.round(PROTEIN_GRAMS_PER_KG[protein] * weightKg)
  const proteinKcal = protein_g * 4

  let fatPct: number
  if (carb === 'low')      fatPct = 0.40
  else if (carb === 'moderate') fatPct = 0.30
  else                          fatPct = 0.25

  const fat_g   = Math.round((tdee * fatPct) / 9)
  const fatKcal = fat_g * 9

  const remaining = tdee - proteinKcal - fatKcal
  const carbs_g   = Math.max(0, Math.round(remaining / 4))

  return { protein_g, carbs_g, fat_g }
}

// Derive a default activity level from the questionnaire's MVPA data
function defaultActivity(mvpaDays: number, mvpaMinutes: number): ActivityLevel {
  const weeklyMins = mvpaDays * mvpaMinutes
  if (weeklyMins === 0)    return 'sedentary'
  if (weeklyMins < 75)     return 'light'
  if (weeklyMins < 150)    return 'moderate'
  if (weeklyMins < 300)    return 'active'
  return 'very_active'
}

// ── Pill selector ─────────────────────────────────────────────────────────────

function PillGroup<T extends string>({
  options, value, onChange, label,
}: {
  options: { id: T; label: string; sub?: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div>
      <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-3">{label}</p>
      <div className="flex flex-col gap-2">
        {options.map(o => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`text-left px-4 py-3 rounded-xl border text-[13px] transition-colors
              ${value === o.id
                ? 'border-ink bg-ink text-card'
                : 'border-border bg-card text-ink hover:border-ink-2'}`}
          >
            <span className="font-medium">{o.label}</span>
            {o.sub && (
              <span className={`block text-[11px] mt-0.5 ${value === o.id ? 'text-[rgba(245,240,208,0.6)]' : 'text-ink-2'}`}>
                {o.sub}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Macro bar ─────────────────────────────────────────────────────────────────

function MacroRow({ label, grams, kcal, color }: { label: string; grams: number; kcal: number; color: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[13px] text-ink">{label}</span>
      </div>
      <div className="text-right">
        <span className="text-[15px] font-medium text-ink tabular-nums">{grams}g</span>
        <span className="text-[11px] text-ink-2 ml-1.5">{kcal} kcal</span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ACTIVITY_OPTIONS: { id: ActivityLevel; label: string; sub: string }[] = [
  { id: 'sedentary',   label: 'Sedentary',       sub: 'Desk job, little or no exercise' },
  { id: 'light',       label: 'Lightly active',  sub: '1–2 days of light exercise per week' },
  { id: 'moderate',    label: 'Moderately active', sub: '3–4 days of moderate exercise per week' },
  { id: 'active',      label: 'Very active',     sub: '5–6 days of hard exercise per week' },
  { id: 'very_active', label: 'Extra active',    sub: 'Daily intense training or physical job' },
]

const GOAL_OPTIONS: { id: DietaryGoal; label: string; sub: string }[] = [
  { id: 'lose_weight',  label: 'Lose weight',  sub: '~15% calorie deficit' },
  { id: 'maintain',     label: 'Maintain',     sub: 'Energy balance' },
  { id: 'gain_muscle',  label: 'Gain muscle',  sub: '~10% calorie surplus' },
]

const PROTEIN_OPTIONS: { id: ProteinTarget; label: string; sub: string }[] = [
  { id: 'standard', label: 'Standard',    sub: '0.8 g per kg — general health' },
  { id: 'high',     label: 'High',        sub: '1.6 g per kg — active individuals' },
  { id: 'athlete',  label: 'Athletic',    sub: '2.2 g per kg — strength or endurance athletes' },
]

const CARB_OPTIONS: { id: CarbApproach; label: string; sub: string }[] = [
  { id: 'low',      label: 'Low carb',      sub: 'Keto or reduced carb approach (~40% fat)' },
  { id: 'moderate', label: 'Moderate carb', sub: 'Balanced approach (~30% fat)' },
  { id: 'standard', label: 'Higher carb',   sub: 'Endurance or plant-based style (~25% fat)' },
]

const MEAL_OPTIONS = [2, 3, 4, 5, 6]

export default function DietAssessmentPage() {
  const router = useRouter()
  const h = mockData.questionnaire.history
  const a = mockData.questionnaire.activity

  // Pre-fill from questionnaire where possible
  const heightCm = parseFloat(h.heightCm) || 0
  const weightKg = parseFloat(h.weightKg) || 0
  const sex      = h.sex || ''
  const ageFromQ = typeof h.age === 'number' ? h.age : null

  const [age,           setAge]           = useState<string>(ageFromQ ? String(ageFromQ) : '')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    defaultActivity(a.mvpaDays, a.mvpaMinutes),
  )
  const [goal,          setGoal]          = useState<DietaryGoal>(mockData.dietaryGoal)
  const [proteinTarget, setProteinTarget] = useState<ProteinTarget>('high')
  const [carbApproach,  setCarbApproach]  = useState<CarbApproach>('moderate')
  const [mealCount,     setMealCount]     = useState(3)

  const missingBiometrics = !heightCm || !weightKg || !sex
  const ageNum = parseInt(age, 10)
  const missingAge = !ageNum || ageNum < 10 || ageNum > 100

  const result = useMemo(() => {
    if (missingBiometrics || missingAge) return null
    const bmr  = calcBMR(weightKg, heightCm, ageNum, sex)
    const tdee = Math.round(bmr * ACTIVITY_MULTIPLIER[activityLevel] * GOAL_MULTIPLIER[goal])
    const macros = calcMacros(tdee, weightKg, proteinTarget, carbApproach)
    return { bmr: Math.round(bmr), tdee, macros }
  }, [weightKg, heightCm, ageNum, sex, activityLevel, goal, proteinTarget, carbApproach, missingBiometrics, missingAge])

  function handleSave() {
    if (!result) return
    const assessment: DietAssessment = {
      completedDate: new Date().toISOString().split('T')[0],
      cycleId:       mockData.currentCycle.id,
      age:           ageNum,
      activityLevel,
      goal,
      proteinTarget,
      carbApproach,
      mealCount,
      bmr:    result.bmr,
      tdee:   result.tdee,
      macros: result.macros,
    }
    saveDietAssessment(assessment)
    // Hard reload → labs entry, then to dashboard with full derived data
    window.location.href = '/labs/entry'
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      <BrandHeader />

      <div className="px-6 pt-4 pb-10 max-w-lg mx-auto flex flex-col gap-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <IconSalad size={18} strokeWidth={1.5} className="text-ink-2" />
            <p className="text-[11px] tracking-[.07em] uppercase text-ink-2">Nutrition assessment</p>
          </div>
          <h1 className="font-serif text-[28px] font-medium text-ink leading-snug">
            Calorie & macro targets.
          </h1>
          <p className="text-[14px] text-ink-2 mt-2 leading-relaxed">
            Done once per 90-day cycle. Your targets feed directly into the daily plan.
          </p>
        </div>

        {/* Missing biometrics warning */}
        {missingBiometrics && (
          <div className="bg-accent/40 border border-border rounded-xl p-4 flex gap-3">
            <IconInfoCircle size={16} strokeWidth={1.5} className="text-ink-2 shrink-0 mt-0.5" />
            <p className="text-[13px] text-ink-2 leading-relaxed">
              Height, weight and sex are needed for an accurate calculation. Please complete the health assessment first, or enter them there and return here.
            </p>
          </div>
        )}

        {/* Age */}
        <div>
          <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-3">Age (years)</p>
          {ageFromQ ? (
            <p className="text-[15px] text-ink font-medium">
              {ageFromQ} <span className="text-[12px] text-ink-2 font-normal">— pulled from health assessment</span>
            </p>
          ) : (
            <input
              type="number"
              min={10}
              max={100}
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="e.g. 35"
              className="w-28 px-4 py-2.5 rounded-xl border border-border bg-card text-[14px] text-ink placeholder-ink-2 focus:outline-none focus:border-ink-2"
            />
          )}
        </div>

        {/* Activity level */}
        <PillGroup
          label="Activity level"
          options={ACTIVITY_OPTIONS}
          value={activityLevel}
          onChange={setActivityLevel}
        />

        {/* Goal */}
        <PillGroup
          label="Goal"
          options={GOAL_OPTIONS}
          value={goal}
          onChange={setGoal}
        />

        {/* Protein target */}
        <PillGroup
          label="Protein preference"
          options={PROTEIN_OPTIONS}
          value={proteinTarget}
          onChange={setProteinTarget}
        />

        {/* Carb approach */}
        <PillGroup
          label="Carbohydrate approach"
          options={CARB_OPTIONS}
          value={carbApproach}
          onChange={setCarbApproach}
        />

        {/* Meal count */}
        <div>
          <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-3">Preferred meals per day</p>
          <div className="flex gap-2">
            {MEAL_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setMealCount(n)}
                className={`w-10 h-10 rounded-full text-[14px] font-medium transition-colors
                  ${mealCount === n ? 'bg-ink text-card' : 'bg-card border border-border text-ink hover:border-ink-2'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Live result card */}
        {result && (
          <div className="bg-card rounded-2xl border border-border shadow-card p-5">
            <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-4">Your daily targets</p>

            {/* TDEE */}
            <div className="flex items-baseline gap-2 mb-5">
              <span className="font-serif text-[44px] font-medium text-ink leading-none">
                {result.tdee.toLocaleString()}
              </span>
              <span className="text-[14px] text-ink-2">kcal / day</span>
            </div>

            {/* Macros */}
            <div>
              <MacroRow
                label="Protein"
                grams={result.macros.protein_g}
                kcal={result.macros.protein_g * 4}
                color="#5A7A50"
              />
              <MacroRow
                label="Carbohydrates"
                grams={result.macros.carbs_g}
                kcal={result.macros.carbs_g * 4}
                color="#C77D2E"
              />
              <MacroRow
                label="Fat"
                grams={result.macros.fat_g}
                kcal={result.macros.fat_g * 9}
                color="#6B6650"
              />
            </div>

            {/* Sub-note */}
            <p className="text-[11px] text-ink-2 mt-4 leading-relaxed">
              BMR {result.bmr.toLocaleString()} kcal · {ACTIVITY_LABEL[activityLevel]} · {mealCount} meals/day
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleSave}
            disabled={!result}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-ink text-card rounded-full text-[13px] font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            Save targets & continue to labs
            <IconChevronRight size={15} strokeWidth={2} />
          </button>

          <button
            onClick={() => { window.location.href = '/labs/entry' }}
            className="text-[12px] text-ink-2 text-center hover:text-ink transition-colors"
          >
            Skip — go straight to lab entry
          </button>
        </div>
      </div>
    </div>
  )
}
