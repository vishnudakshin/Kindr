'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { IconChevronLeft } from '@tabler/icons-react'
import { BrandHeader } from '@/components/ui/BrandHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  saveDietLog, getDietLog, saveDietaryGoal, getDietaryGoal,
  saveDietAssessment, getDietAssessment, mockData,
} from '@/lib/data'
import {
  FOOD_DB, FOOD_MAP, mealKcal, mealMacros, estimateDietCalories, estimateDietMacros,
  deriveActivityLevel, computeTDEEFromLevel, computeTargetCalories, computeMacroTargetsV2,
  ACTIVITY_LABEL_SHORT, ACTIVITY_LABEL_FULL, ACTIVITY_MULTIPLIER, PACE_KCAL,
  type MealSlot,
} from '@/lib/nutrition-table'
import type {
  DietLog, DietMeal,
  DietaryGoal, DietPace, MacroApproach, DietVariability, ActivityLevel,
} from '@/lib/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const GOALS: { id: DietaryGoal; label: string; emoji: string; sub: string }[] = [
  { id: 'lose_weight',  label: 'Lose weight',   emoji: '↓', sub: 'Calorie deficit' },
  { id: 'maintain',     label: 'Maintain',       emoji: '→', sub: 'Energy balance'  },
  { id: 'gain_weight',  label: 'Gain weight',    emoji: '↑', sub: 'Calorie surplus' },
  { id: 'gain_muscle',  label: 'Build muscle',   emoji: '↑', sub: 'Lean bulk'       },
]

const PACES: { id: DietPace; label: string; sub: string }[] = [
  { id: 'gentle', label: 'Gentle',  sub: '~0.25 kg/week' },
  { id: 'steady', label: 'Steady',  sub: '~0.5 kg/week'  },
  { id: 'faster', label: 'Faster',  sub: '~0.75–1 kg/week' },
]

const MACRO_APPROACHES: { id: MacroApproach; label: string; sub: string }[] = [
  { id: 'balanced',     label: 'Balanced',       sub: '50% carbs · 30% fat · 20% protein' },
  { id: 'high_protein', label: 'Higher protein',  sub: 'Good for muscle & strength'         },
  { id: 'low_carb',     label: 'Lower carb',      sub: '<100g carbs/day, more fat'          },
  { id: 'custom',       label: 'Let me customise', sub: 'Set your own targets'               },
]

const ACTIVITY_LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active']

const VARIABILITY_OPTIONS: { id: DietVariability; label: string }[] = [
  { id: 'consistent',   label: 'Pretty consistent'   },
  { id: 'varies_bit',   label: 'Varies a bit'        },
  { id: 'varies_lot',   label: 'Varies a lot'        },
]

const EMPTY_MEAL = (): DietMeal => ({ selections: {}, freeText: '' })
const EMPTY_LOG  = (): DietLog => ({
  breakfast:   EMPTY_MEAL(),
  midMorning:  EMPTY_MEAL(),
  lunch:       EMPTY_MEAL(),
  evening:     EMPTY_MEAL(),
  dinner:      EMPTY_MEAL(),
  beverages:   EMPTY_MEAL(),
  supplements: '',
})

const MEAL_CONFIG: { slot: MealSlot; label: string; placeholder: string }[] = [
  {
    slot: 'breakfast', label: 'Breakfast',
    placeholder: 'e.g. 2 idli with sambar and chutney, 1 cup chai',
  },
  {
    slot: 'lunch', label: 'Lunch',
    placeholder: 'e.g. rice, dal, sabzi, small bowl of curd',
  },
  {
    slot: 'dinner', label: 'Dinner',
    placeholder: 'e.g. 2 chapati, vegetable curry, raita',
  },
  {
    slot: 'beverages', label: 'Snacks & beverages',
    placeholder: 'e.g. morning chai, afternoon fruit, evening biscuits or nuts',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function Chip({
  active, onClick, children, size = 'md',
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; size?: 'sm' | 'md'
}) {
  return (
    <button
      onClick={onClick}
      className={`border rounded-full transition-colors cursor-pointer
        ${size === 'sm' ? 'px-3 py-1 text-[12px]' : 'px-4 py-2 text-[13px]'}
        ${active ? 'bg-ink border-ink text-card' : 'bg-card border-border text-ink hover:border-ink-2'}`}
    >
      {children}
    </button>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-2 mt-5">{children}</p>
  )
}

// ── MealSection ───────────────────────────────────────────────────────────────

interface BreakdownItem {
  item: string; kcal: number
  protein_g?: number; fat_g?: number; carb_g?: number; fiber_g?: number
}

function MealSection({
  slot, label, placeholder, meal, onChange,
}: {
  slot: MealSlot; label: string; placeholder: string
  meal: DietMeal; onChange: (m: DietMeal) => void
}) {
  const foods    = FOOD_DB.filter(f => f.meals.includes(slot))
  const kcal     = mealKcal(meal)
  const macros   = mealMacros(meal)
  const selected = Object.keys(meal.selections)

  const [loading,   setLoading]   = useState(false)
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([])
  const [error,     setError]     = useState('')
  const lastEstimatedText = useRef('')
  const textChanged = meal.freeText.trim() !== lastEstimatedText.current

  function toggleFood(id: string) {
    const next = { ...meal.selections }
    if (next[id]) { delete next[id] } else { next[id] = FOOD_MAP[id].portions[0].label }
    onChange({ ...meal, selections: next })
  }

  function setPortion(foodId: string, portionLabel: string) {
    onChange({ ...meal, selections: { ...meal.selections, [foodId]: portionLabel } })
  }

  async function estimateCalories() {
    if (!meal.freeText.trim()) return
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/diet-calories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal: label, text: meal.freeText }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error ?? 'Estimation failed.'); return }
      onChange({
        ...meal,
        freeTextKcal:   data.total,
        freeTextMacros: data.totalMacros,
      })
      setBreakdown(data.breakdown ?? [])
      lastEstimatedText.current = meal.freeText.trim()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  const hasEstimate = meal.freeTextKcal != null && !textChanged

  return (
    <Card className="mb-3">
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-[14px] font-medium text-ink">{label}</p>
        {kcal > 0 && <span className="text-[12px] text-ink-2">~{kcal} kcal</span>}
      </div>
      {kcal > 0 && (
        <p className="text-[11px] text-ink-2 mb-3">
          P {Math.round(macros.protein_g)}g · C {Math.round(macros.carb_g)}g · F {Math.round(macros.fat_g)}g
        </p>
      )}

      {/* Food chips with kcal */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {foods.map(food => {
          const defaultKcal = food.portions[0]?.kcal
          return (
            <button
              key={food.id}
              onClick={() => toggleFood(food.id)}
              className={`border rounded-[20px] px-3 py-1.5 text-[12px] cursor-pointer transition-colors leading-none
                ${meal.selections[food.id]
                  ? 'bg-ink border-ink text-card'
                  : 'bg-card border-border text-ink hover:border-ink'}`}
            >
              {food.name}
              {defaultKcal !== undefined && (
                <span className={`ml-1.5 text-[10px] ${meal.selections[food.id] ? 'opacity-60' : 'text-ink-2'}`}>
                  {defaultKcal} kcal
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected items + portion pickers */}
      {selected.length > 0 && (
        <div className="bg-bg rounded-xl p-3 mb-3 space-y-3">
          {selected.map(foodId => {
            const food = FOOD_MAP[foodId]
            if (!food) return null
            return (
              <div key={foodId}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-medium text-ink">{food.name}</span>
                  <button
                    onClick={() => toggleFood(foodId)}
                    className="text-[11px] text-ink-2 hover:text-ink transition-colors"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {food.portions.map(p => (
                    <button
                      key={p.label}
                      onClick={() => setPortion(foodId, p.label)}
                      className={`border rounded-[14px] px-2.5 py-1 text-[11px] cursor-pointer transition-colors
                        ${meal.selections[foodId] === p.label
                          ? 'bg-ink border-ink text-card'
                          : 'bg-card border-border text-ink-2 hover:border-ink'}`}
                    >
                      {p.label} · {p.kcal} kcal
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Free text + LLM estimation */}
      <textarea
        value={meal.freeText}
        onChange={e => onChange({
          ...meal,
          freeText: e.target.value,
          freeTextKcal: undefined,
          freeTextMacros: undefined,
        })}
        placeholder={placeholder}
        rows={2}
        className="w-full border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-ink bg-card placeholder:text-ink-2/50 outline-none focus:border-ink resize-none transition-colors"
      />

      {meal.freeText.trim().length > 0 && (
        <div className="mt-2">
          <button
            onClick={estimateCalories}
            disabled={loading}
            className="text-[11px] text-ink underline underline-offset-2 disabled:opacity-40 cursor-pointer hover:text-ink-2 transition-colors"
          >
            {loading ? 'Estimating…' : hasEstimate ? 'Re-estimate calories & macros' : 'Estimate calories & macros'}
          </button>
          {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
          {hasEstimate && breakdown.length > 0 && (
            <div className="mt-2 bg-bg rounded-lg p-2.5 space-y-1">
              {breakdown.map((b, i) => (
                <div key={i} className="flex justify-between text-[11px] text-ink-2">
                  <span>{b.item}</span>
                  <span>{b.kcal} kcal</span>
                </div>
              ))}
              <div className="pt-1.5 mt-1 border-t border-border">
                <div className="flex justify-between text-[12px] font-medium text-ink mb-1">
                  <span>Total</span>
                  <span>~{meal.freeTextKcal} kcal</span>
                </div>
                {meal.freeTextMacros && (
                  <p className="text-[11px] text-ink-2">
                    P {Math.round(meal.freeTextMacros.protein_g)}g · C {Math.round(meal.freeTextMacros.carb_g)}g · F {Math.round(meal.freeTextMacros.fat_g)}g
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DietEntryPage() {
  const router = useRouter()
  const { history, activity } = mockData.questionnaire

  // Derive activity level from questionnaire data as the starting suggestion
  const derived = deriveActivityLevel(activity)

  // ── Step 1 state ─────────────────────────────────────────────────────────
  const [step,          setStep]         = useState<1 | 2>(1)
  const [goal,          setGoal]         = useState<DietaryGoal>(() => getDietaryGoal())
  const [targetWeightKg, setTargetWeight] = useState<string>(() => {
    const a = getDietAssessment()
    return a?.targetWeightKg ? String(a.targetWeightKg) : ''
  })
  const [pace,          setPace]         = useState<DietPace>(() => getDietAssessment()?.pace ?? 'steady')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(() => {
    const a = getDietAssessment()
    return a?.activityLevel ?? derived
  })
  const [macroApproach, setMacroApproach] = useState<MacroApproach>(() => getDietAssessment()?.macroApproach ?? 'balanced')

  // ── Step 2 state ─────────────────────────────────────────────────────────
  const [log,         setLog]         = useState<DietLog>(() => getDietLog() ?? EMPTY_LOG())
  const [variability, setVariability] = useState<DietVariability>(() => getDietAssessment()?.variability ?? 'consistent')

  // ── Live TDEE calculations ────────────────────────────────────────────────
  const currentWeightKg = history.unit === 'metric'
    ? parseFloat(history.weightKg) || null
    : parseFloat(history.weightLbs) ? parseFloat(history.weightLbs) * 0.453592 : null

  const tdee = computeTDEEFromLevel(history, activityLevel)
  const targetCalories = tdee ? computeTargetCalories(tdee, goal, pace) : null
  const macroTargets = currentWeightKg && targetCalories
    ? computeMacroTargetsV2(currentWeightKg, targetCalories, macroApproach, history.sex)
    : null

  const totalKcal   = estimateDietCalories(log)
  const totalMacros = estimateDietMacros(log)

  function updateMeal(slot: MealSlot, meal: DietMeal) {
    setLog(prev => ({ ...prev, [slot]: meal }))
  }

  function handleSave() {
    saveDietLog(log)
    saveDietaryGoal(goal)
    saveDietAssessment({
      completedDate: new Date().toISOString().split('T')[0],
      cycleId:       mockData.currentCycle.id,
      age:           history.age ?? 0,
      activityLevel,
      goal,
      proteinTarget: macroApproach === 'high_protein' ? 'high' : 'standard',
      carbApproach:  macroApproach === 'low_carb' ? 'low' : 'standard',
      mealCount:     4,
      bmr:           tdee ? Math.round(tdee / ACTIVITY_MULTIPLIER[activityLevel]) : 0,
      tdee:          tdee ?? 0,
      macros: macroTargets
        ? { protein_g: macroTargets.protein_g, carbs_g: macroTargets.carbs_g, fat_g: macroTargets.fat_g }
        : { protein_g: 0, carbs_g: 0, fat_g: 0 },
      targetWeightKg: targetWeightKg ? parseFloat(targetWeightKg) : undefined,
      pace,
      macroApproach,
      variability,
      targetTdee: targetCalories ?? undefined,
    })
    router.push('/labs/entry')
  }

  // ── Step 1 ────────────────────────────────────────────────────────────────
  if (step === 1) {
    const showTargetWeight = goal === 'lose_weight' || goal === 'gain_weight'
    const showPace         = goal !== 'maintain'
    const currentWtDisplay = currentWeightKg ? currentWeightKg.toFixed(1) : '—'

    return (
      <div className="min-h-screen bg-bg pb-28">
        <BrandHeader />
        <div className="px-6 pt-5">
          <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1.5">Diet · Step 1 of 2</p>
          <h2 className="font-serif text-[26px] font-medium text-ink leading-snug mb-1">
            Set your nutrition goal.
          </h2>
          <p className="text-[13px] text-ink-2 leading-relaxed mb-6">
            We'll use your questionnaire data to suggest the right targets — confirm or adjust below.
          </p>

          {/* Goal */}
          <SectionLabel>What's your goal right now?</SectionLabel>
          <div className="grid grid-cols-2 gap-2 mb-1">
            {GOALS.map(g => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`flex flex-col items-start p-4 rounded-2xl border text-left transition-colors cursor-pointer
                  ${goal === g.id ? 'bg-ink border-ink text-card' : 'bg-card border-border text-ink hover:border-ink-2'}`}
              >
                <span className={`text-[20px] mb-1 ${goal === g.id ? 'opacity-80' : 'opacity-40'}`}>{g.emoji}</span>
                <span className="text-[14px] font-medium leading-tight">{g.label}</span>
                <span className={`text-[11px] mt-0.5 ${goal === g.id ? 'opacity-60' : 'text-ink-2'}`}>{g.sub}</span>
              </button>
            ))}
          </div>

          {/* Current + target weight */}
          <SectionLabel>Weight</SectionLabel>
          <div className="bg-card border border-border rounded-2xl px-5 py-4 mb-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[.05em] text-ink-2 mb-0.5">Current</p>
                <p className="font-serif text-[22px] font-medium text-ink">
                  {currentWtDisplay} <span className="text-[13px] font-sans font-normal text-ink-2">kg</span>
                </p>
              </div>
              {showTargetWeight && (
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[.05em] text-ink-2 mb-0.5">Target (optional)</p>
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      value={targetWeightKg}
                      onChange={e => setTargetWeight(e.target.value)}
                      placeholder="—"
                      min={30}
                      max={200}
                      className="w-16 text-right font-serif text-[22px] font-medium text-ink bg-transparent border-b border-ink-2 focus:border-ink outline-none pb-0.5"
                    />
                    <span className="text-[13px] text-ink-2">kg</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pace */}
          {showPace && (
            <>
              <SectionLabel>How would you like to get there?</SectionLabel>
              <div className="flex gap-2 mb-1">
                {PACES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPace(p.id)}
                    className={`flex-1 flex flex-col items-center py-3 px-1 rounded-2xl border text-center transition-colors cursor-pointer
                      ${pace === p.id ? 'bg-ink border-ink text-card' : 'bg-card border-border text-ink hover:border-ink-2'}`}
                  >
                    <span className="text-[13px] font-medium leading-tight">{p.label}</span>
                    <span className={`text-[11px] mt-0.5 ${pace === p.id ? 'opacity-60' : 'text-ink-2'}`}>{p.sub}</span>
                  </button>
                ))}
              </div>
              {tdee && (
                <p className="text-[11px] text-ink-2 mb-1">
                  Daily target: ~{computeTargetCalories(tdee, goal, pace).toLocaleString()} kcal
                  {goal === 'lose_weight' ? ` (${PACE_KCAL[pace]} kcal below maintenance)` : ` (${PACE_KCAL[pace]} kcal above maintenance)`}
                </p>
              )}
            </>
          )}

          {/* Activity level — derived, confirm or adjust */}
          <SectionLabel>Activity level</SectionLabel>
          <div className="bg-card border border-border rounded-2xl px-5 py-4 mb-1">
            <p className="text-[13px] text-ink mb-3">
              Based on your questionnaire, we think you're{' '}
              <span className="font-medium">{ACTIVITY_LABEL_SHORT[derived]}</span>.{' '}
              Does that sound right?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_LEVELS.map(lv => (
                <button
                  key={lv}
                  onClick={() => setActivityLevel(lv)}
                  className={`border rounded-full px-3 py-1 text-[12px] transition-colors cursor-pointer
                    ${activityLevel === lv
                      ? 'bg-ink border-ink text-card'
                      : lv === derived
                        ? 'bg-accent border-accent text-ink hover:border-ink-2'
                        : 'bg-card border-border text-ink-2 hover:border-ink'}`}
                >
                  {ACTIVITY_LABEL_SHORT[lv]}
                </button>
              ))}
            </div>
            {activityLevel !== derived && (
              <p className="text-[11px] text-ink-2 mt-2">
                Adjusted from "{ACTIVITY_LABEL_SHORT[derived]}"
              </p>
            )}
          </div>

          {/* Macro approach */}
          <SectionLabel>How would you like your plan balanced?</SectionLabel>
          <div className="space-y-2 mb-1">
            {MACRO_APPROACHES.map(a => (
              <button
                key={a.id}
                onClick={() => setMacroApproach(a.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-left transition-colors cursor-pointer
                  ${macroApproach === a.id ? 'bg-ink border-ink text-card' : 'bg-card border-border text-ink hover:border-ink-2'}`}
              >
                <div>
                  <span className="text-[13px] font-medium">{a.label}</span>
                  <p className={`text-[11px] mt-0.5 ${macroApproach === a.id ? 'opacity-60' : 'text-ink-2'}`}>{a.sub}</p>
                </div>
                {macroApproach === a.id && (
                  <div className="w-4 h-4 rounded-full bg-card/20 flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-card" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* TDEE summary card */}
          {targetCalories && (
            <Card className="mt-4 mb-2 bg-bg-soft">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[.05em] text-ink-2 mb-0.5">Daily target</p>
                  <p className="font-serif text-[28px] font-medium text-ink leading-none">
                    ~{targetCalories.toLocaleString()}
                    <span className="text-[14px] font-sans font-normal text-ink-2 ml-1">kcal</span>
                  </p>
                </div>
                {tdee && (
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-[.05em] text-ink-2 mb-0.5">Maintenance</p>
                    <p className="text-[20px] font-medium text-ink-2">~{tdee.toLocaleString()}</p>
                  </div>
                )}
              </div>
              {macroTargets && (
                <div className="border-t border-border pt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Protein', value: macroTargets.protein_g },
                    { label: 'Carbs',   value: macroTargets.carbs_g },
                    { label: 'Fat',     value: macroTargets.fat_g },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[11px] text-ink-2">{label}</p>
                      <p className="text-[16px] font-medium text-ink">{value}g</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-bg border-t border-border px-6 py-4 flex gap-3">
          <Button variant="outline" onClick={() => router.push('/questionnaire')}>
            Back
          </Button>
          <Button variant="filled" className="flex-1" onClick={() => setStep(2)}>
            Next — log typical day
          </Button>
        </div>
      </div>
    )
  }

  // ── Step 2 ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg pb-28">
      <BrandHeader />
      <div className="px-6 pt-5">
        <button
          onClick={() => setStep(1)}
          className="flex items-center gap-1 text-[12px] text-ink-2 hover:text-ink transition-colors mb-4 cursor-pointer"
        >
          <IconChevronLeft size={14} strokeWidth={1.5} />
          Edit goals
        </button>

        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1.5">Diet · Step 2 of 2</p>
        <h2 className="font-serif text-[26px] font-medium text-ink leading-snug mb-1">
          A typical day for you.
        </h2>
        <p className="text-[13px] text-ink-2 leading-relaxed mb-5">
          Describe what you usually eat. We'll estimate your calories and macros to compare against your target.
        </p>

        {/* Target summary strip */}
        {targetCalories && (
          <div className="bg-card border border-border rounded-2xl px-5 py-3 mb-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-ink-2">Your daily target</p>
              <p className="font-serif text-[20px] font-medium text-ink leading-tight">~{targetCalories.toLocaleString()} kcal</p>
            </div>
            {totalKcal > 0 && (
              <div className="text-right">
                <p className="text-[11px] text-ink-2">Logged so far</p>
                <p className={`font-serif text-[20px] font-medium leading-tight ${
                  totalKcal > targetCalories * 1.1 ? 'text-[#C77D2E]' : 'text-ink'}`}>
                  ~{totalKcal.toLocaleString()} kcal
                </p>
              </div>
            )}
          </div>
        )}

        {/* Meal sections */}
        {MEAL_CONFIG.map(({ slot, label, placeholder }) => (
          <MealSection
            key={slot}
            slot={slot}
            label={label}
            placeholder={placeholder}
            meal={log[slot]}
            onChange={meal => updateMeal(slot, meal)}
          />
        ))}

        {/* Macro summary */}
        {totalKcal > 0 && (
          <Card className="mb-3 bg-bg-soft">
            <p className="text-[11px] uppercase tracking-[.06em] text-ink-2 mb-2">Today's total</p>
            <p className="font-serif text-[24px] font-medium text-ink mb-3">
              ~{totalKcal.toLocaleString()} kcal
            </p>
            <div className="grid grid-cols-3 gap-2 text-center border-t border-border pt-3">
              {[
                { label: 'Protein', value: totalMacros.protein_g, target: macroTargets?.protein_g },
                { label: 'Carbs',   value: totalMacros.carb_g,    target: macroTargets?.carbs_g },
                { label: 'Fat',     value: totalMacros.fat_g,      target: macroTargets?.fat_g },
              ].map(({ label, value, target }) => (
                <div key={label}>
                  <p className="text-[11px] text-ink-2">{label}</p>
                  <p className="text-[15px] font-medium text-ink">
                    {Math.round(value)}g
                    {target && <span className="text-[11px] font-normal text-ink-2"> /{target}g</span>}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Variability check */}
        <div className="mt-2 mb-6">
          <p className="text-[13px] font-medium text-ink mb-3">
            How consistent is this day-to-day?
          </p>
          <div className="flex flex-wrap gap-2">
            {VARIABILITY_OPTIONS.map(v => (
              <Chip key={v.id} active={variability === v.id} onClick={() => setVariability(v.id)}>
                {v.label}
              </Chip>
            ))}
          </div>
          <p className="text-[11px] text-ink-2 mt-2">
            {variability === 'consistent'
              ? "Great — we'll treat this as your baseline."
              : variability === 'varies_bit'
                ? "We'll use this as a loose average and flag bigger gaps."
                : "Noted — your plan will be based on typical ranges rather than daily targets."}
          </p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-bg border-t border-border px-6 py-4 flex gap-3">
        <Button variant="outline" onClick={() => router.push('/labs/entry')}>
          Skip for now
        </Button>
        <Button variant="filled" className="flex-1" onClick={handleSave}>
          Save & continue
        </Button>
      </div>
    </div>
  )
}
