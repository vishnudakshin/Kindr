'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BrandHeader } from '@/components/ui/BrandHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { saveDietLog, getDietLog, saveDietaryGoal, getDietaryGoal, mockData } from '@/lib/data'
import {
  FOOD_DB, FOOD_MAP, mealKcal, mealMacros, estimateDietCalories, estimateDietMacros,
  computeTDEE, computeMacroTargets,
  type MealSlot,
} from '@/lib/nutrition-table'
import type { DietLog, DietMeal, MacroNutrients, DietaryGoal } from '@/lib/types'

// ── Goal config ───────────────────────────────────────────────────────────────

const GOALS: { id: DietaryGoal; label: string; sub: string; multiplier: number }[] = [
  { id: 'lose_weight',  label: 'Lose weight',  sub: '~15% deficit', multiplier: 0.85 },
  { id: 'maintain',     label: 'Maintain',     sub: 'Energy balance', multiplier: 1.0  },
  { id: 'gain_muscle',  label: 'Gain muscle',  sub: '~10% surplus', multiplier: 1.10 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPTY_MEAL = (): DietMeal => ({ selections: {}, freeText: '' })
const EMPTY_LOG  = (): DietLog => ({
  breakfast:  EMPTY_MEAL(),
  midMorning: EMPTY_MEAL(),
  lunch:      EMPTY_MEAL(),
  evening:    EMPTY_MEAL(),
  dinner:     EMPTY_MEAL(),
  beverages:  EMPTY_MEAL(),
  supplements: '',
})

const MEAL_CONFIG: { slot: MealSlot; label: string; sub: string }[] = [
  { slot: 'breakfast',  label: 'Breakfast',    sub: 'Your typical morning meal' },
  { slot: 'midMorning', label: 'Mid-morning',  sub: 'Snack or drink between breakfast and lunch' },
  { slot: 'lunch',      label: 'Lunch',        sub: 'Your midday meal' },
  { slot: 'evening',    label: 'Evening',      sub: 'Evening snack or tea-time' },
  { slot: 'dinner',     label: 'Dinner',       sub: 'Your evening meal' },
  { slot: 'beverages',  label: 'Beverages',    sub: 'Drinks throughout the day (excluding water)' },
]

// ── MacroBar ─────────────────────────────────────────────────────────────────

function MacroBar({
  label, value, target, unit = 'g', color = 'bg-ink',
}: {
  label: string; value: number; target?: number; unit?: string; color?: string
}) {
  const pct = target && target > 0 ? Math.min(100, Math.round((value / target) * 100)) : null
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-ink-2 w-14 shrink-0">{label}</span>
      <span className="text-[12px] font-medium text-ink w-12 shrink-0 tabular-nums">
        ~{Math.round(value)}{unit}
      </span>
      {pct !== null && (
        <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {target !== undefined && (
        <span className="text-[11px] text-ink-2 shrink-0 tabular-nums">
          /{Math.round(target)}{unit}
        </span>
      )}
    </div>
  )
}

// ── MealSection ───────────────────────────────────────────────────────────────

interface BreakdownItem {
  item: string; kcal: number
  protein_g?: number; fat_g?: number; carb_g?: number; fiber_g?: number
}

function MealSection({
  slot, label, sub, meal, onChange,
}: {
  slot: MealSlot; label: string; sub: string
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
    <div className="mb-1">
      <Card className="mb-3">
        {/* Section header */}
        <div className="flex items-baseline justify-between mb-0.5">
          <p className="text-[14px] font-medium text-ink">{label}</p>
          {kcal > 0 && (
            <span className="text-[12px] text-ink-2">~{kcal} kcal</span>
          )}
        </div>
        <p className="text-[12px] text-ink-2 mb-2">{sub}</p>

        {/* Inline macro summary for this meal */}
        {kcal > 0 && (
          <p className="text-[11px] text-ink-2 mb-3">
            P {Math.round(macros.protein_g)}g · C {Math.round(macros.carb_g)}g · F {Math.round(macros.fat_g)}g · Fi {Math.round(macros.fiber_g)}g
          </p>
        )}

        {/* Food chip grid */}
        <div className="flex flex-wrap gap-2 mb-3">
          {foods.map(food => (
            <button
              key={food.id}
              onClick={() => toggleFood(food.id)}
              className={`border rounded-[20px] px-3 py-1.5 text-[12px] cursor-pointer transition-colors
                ${meal.selections[food.id]
                  ? 'bg-ink border-ink text-bg'
                  : 'bg-card border-border text-ink hover:border-ink'}`}
            >
              {food.name}
            </button>
          ))}
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
                            ? 'bg-ink border-ink text-bg'
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
          placeholder="Add anything else with quantities for calorie estimates (e.g. 1 cup yogurt, 30 g cheese, 2 tbsp peanut butter)…"
          className="w-full border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-ink bg-card placeholder:text-ink-2/50 outline-none focus:border-ink resize-none min-h-[56px] transition-colors"
        />

        {/* Estimate button + result */}
        {meal.freeText.trim().length > 0 && (
          <div className="mt-2">
            <button
              onClick={estimateCalories}
              disabled={loading}
              className="text-[11px] text-ink underline underline-offset-2 disabled:opacity-40 cursor-pointer hover:text-ink-2 transition-colors"
            >
              {loading ? 'Estimating…' : hasEstimate ? 'Re-estimate calories & macros' : 'Estimate calories & macros'}
            </button>

            {error && (
              <p className="text-[11px] text-red-500 mt-1">{error}</p>
            )}

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
                    <span>Free text total</span>
                    <span>~{meal.freeTextKcal} kcal</span>
                  </div>
                  {meal.freeTextMacros && (
                    <p className="text-[11px] text-ink-2">
                      P {Math.round(meal.freeTextMacros.protein_g)}g · C {Math.round(meal.freeTextMacros.carb_g)}g · F {Math.round(meal.freeTextMacros.fat_g)}g · Fi {Math.round(meal.freeTextMacros.fiber_g)}g
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DietEntryPage() {
  const router = useRouter()

  const [log,  setLog]  = useState<DietLog>(() => getDietLog() ?? EMPTY_LOG())
  const [goal, setGoal] = useState<DietaryGoal>(() => getDietaryGoal())

  const totalKcal       = estimateDietCalories(log)
  const totalMacros     = estimateDietMacros(log)
  const tdee            = computeTDEE(mockData.questionnaire.history, mockData.questionnaire.activity)
  const macroTargets    = computeMacroTargets(mockData.questionnaire.history, mockData.questionnaire.activity)
  const goalMultiplier  = GOALS.find(g => g.id === goal)?.multiplier ?? 1.0
  const adjustedTarget  = tdee !== null ? Math.round(tdee * goalMultiplier) : null

  function updateMeal(slot: MealSlot, meal: DietMeal) {
    setLog(prev => ({ ...prev, [slot]: meal }))
  }

  function handleGoalChange(g: DietaryGoal) {
    setGoal(g)
    saveDietaryGoal(g)
  }

  function handleSave() {
    saveDietLog(log)
    router.push('/labs/entry')
  }

  function handleSkip() {
    router.push('/labs/entry')
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      <BrandHeader />

      <div className="px-6 pt-5">
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1.5">Diet</p>
        <h2 className="font-serif text-[19px] font-medium text-ink leading-snug mb-1">
          What does a typical day look like?
        </h2>
        <p className="text-[13px] text-ink-2 leading-relaxed mb-5">
          Select everything you usually eat and drink. Calorie and macro estimates are approximate.
        </p>

        {/* Calorie + macro overview card */}
        <Card className="mb-6 bg-bg-soft">
          {/* Goal selector */}
          <p className="text-[11px] uppercase tracking-[.06em] text-ink-2 mb-2">Your goal</p>
          <div className="flex gap-2 mb-4">
            {GOALS.map(g => (
              <button
                key={g.id}
                onClick={() => handleGoalChange(g.id)}
                className={`flex-1 flex flex-col items-center py-2 px-1 rounded-xl border text-center transition-colors ${
                  goal === g.id
                    ? 'bg-ink border-ink text-bg'
                    : 'bg-card border-border text-ink hover:border-ink'
                }`}
              >
                <span className="text-[12px] font-medium leading-snug">{g.label}</span>
                <span className={`text-[10px] leading-snug mt-0.5 ${goal === g.id ? 'opacity-60' : 'text-ink-2'}`}>
                  {g.sub}
                </span>
              </button>
            ))}
          </div>

          {/* Calorie row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[.06em] text-ink-2 mb-0.5">Logged so far</p>
              <p className="font-serif text-[28px] font-medium text-ink leading-none">
                ~{totalKcal.toLocaleString()}
                <span className="text-[14px] font-sans font-normal text-ink-2 ml-1">kcal</span>
              </p>
            </div>
            {adjustedTarget !== null && (
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[.06em] text-ink-2 mb-0.5">Daily target</p>
                <p className="font-serif text-[28px] font-medium text-ink leading-none">
                  ~{adjustedTarget.toLocaleString()}
                  <span className="text-[14px] font-sans font-normal text-ink-2 ml-1">kcal</span>
                </p>
              </div>
            )}
          </div>

          {/* Calorie progress bar */}
          {adjustedTarget !== null && totalKcal > 0 && (
            <div className="mt-3 mb-4">
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-ink rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((totalKcal / adjustedTarget) * 100))}%` }}
                />
              </div>
              <p className="text-[11px] text-ink-2 mt-1">
                {Math.round((totalKcal / adjustedTarget) * 100)}% of daily target
                {goal !== 'maintain' && tdee !== null && (
                  <span className="ml-1 opacity-70">
                    (maintenance: ~{tdee.toLocaleString()} kcal)
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Macro breakdown — shown as soon as anything is logged */}
          {totalKcal > 0 && (
            <div className="border-t border-border pt-3 space-y-2">
              <MacroBar
                label="Protein"
                value={totalMacros.protein_g}
                target={macroTargets?.protein_g}
                color="bg-ink"
              />
              <MacroBar
                label="Carbs"
                value={totalMacros.carb_g}
                target={macroTargets?.carb_g}
                color="bg-ink-2"
              />
              <MacroBar
                label="Fat"
                value={totalMacros.fat_g}
                target={macroTargets?.fat_g}
                color="bg-ink-2"
              />
              <MacroBar
                label="Fiber"
                value={totalMacros.fiber_g}
                target={macroTargets?.fiber_g}
                color="bg-ink"
              />
            </div>
          )}
        </Card>

        {/* Meal sections */}
        {MEAL_CONFIG.map(({ slot, label, sub }) => (
          <MealSection
            key={slot}
            slot={slot}
            label={label}
            sub={sub}
            meal={log[slot]}
            onChange={meal => updateMeal(slot, meal)}
          />
        ))}

        {/* Supplements / other */}
        <Card className="mb-3">
          <p className="text-[14px] font-medium text-ink mb-1">Supplements & other</p>
          <p className="text-[12px] text-ink-2 mb-3">
            Vitamins, protein powder, post-dinner snacks, or anything not listed above.
          </p>
          <textarea
            value={log.supplements}
            onChange={e => setLog(prev => ({ ...prev, supplements: e.target.value }))}
            placeholder="e.g. Vitamin D 2000 IU, whey protein, evening chocolate…"
            className="w-full border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-ink bg-card placeholder:text-ink-2/50 outline-none focus:border-ink resize-none min-h-[64px] transition-colors"
          />
        </Card>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-bg border-t border-border px-6 py-4 flex gap-3">
        <Button variant="outline" onClick={handleSkip}>
          Skip for now
        </Button>
        <Button variant="outline" className="flex-1" onClick={handleSave}>
          Save & continue
        </Button>
      </div>
    </div>
  )
}
