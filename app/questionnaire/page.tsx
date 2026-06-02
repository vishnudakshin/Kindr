'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconBolt, IconMoodSmile, IconBrain, IconMoon, IconSalad, IconRun, IconShieldCheck, IconSparkles,
  IconMoodHappy, IconMoodNeutral, IconMoodNervous, IconMoodSad,
  IconFlame, IconWalk, IconBattery1, IconBattery2, IconBattery3, IconBattery4, IconArmchair,
  IconMoonOff, IconMoonStars, IconZzz, IconClock, IconClockX,
  IconLeaf, IconDroplet, IconBurger, IconGlass,
  IconTargetOff, IconTarget, IconCrosshair, IconSun, IconCloud, IconCloudFog, IconDatabase,
} from '@tabler/icons-react'
import type { FC } from 'react'
import { BrandHeader } from '@/components/ui/BrandHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Slider } from '@/components/ui/Slider'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { saveQuestionnaire } from '@/lib/data'
import type {
  GoalId, QuestionnaireResponses,
  HistoryResponses, StressResponses, ActivityResponses, SleepResponses,
  NutritionResponses, CognitionResponses, SymptomsResponses,
} from '@/lib/types'

type TablerIcon = FC<{ size?: number; className?: string; strokeWidth?: number }>

// ── Icon + label lookup tables (mirrors kindr_questionnaire_v2.html) ──

const STRESS_ICONS: TablerIcon[] = [IconMoodHappy, IconMoodSmile, IconMoodNeutral, IconMoodNervous, IconMoodSad]
const STRESS_ICONS_POS: TablerIcon[] = [IconMoodSad, IconMoodNervous, IconMoodNeutral, IconMoodSmile, IconMoodHappy]
const STRESS_LABELS = ['Never', 'Rarely', 'Occasionally', 'Quite often', 'Very often']

const ENERGY_ICONS: TablerIcon[] = [IconBattery1, IconBattery2, IconBattery3, IconBattery4, IconBolt]
const ENERGY_LABELS = ['Very low', 'Low energy', 'Moderate', 'Good energy', 'Excellent']

const SLEEP_ICONS: TablerIcon[] = [IconMoonOff, IconMoonStars, IconMoonStars, IconMoon, IconMoon, IconMoon]
const SLEEP_LABELS = ['3 hrs or less', '4–5 hrs', '5–6 hrs', '6–7 hrs', '8–9 hrs', '10+ hrs']

const LATENCY_ICONS: TablerIcon[] = [IconZzz, IconZzz, IconClock, IconClock, IconClockX, IconClockX]
const LATENCY_LABELS = ['Instantly', '5–10 min', '10–20 min', '20–30 min', '30–60 min', '60+ min']

const RESTED_ICONS: TablerIcon[] = [IconMoodSad, IconMoodSad, IconMoodNeutral, IconMoodSmile, IconMoodHappy]
const RESTED_LABELS = ['Exhausted', 'Still tired', 'Somewhat rested', 'Rested', 'Fully refreshed']

const FOCUS_ICONS: TablerIcon[] = [IconTargetOff, IconTargetOff, IconTarget, IconTarget, IconCrosshair]
const FOCUS_LABELS = ['Cannot focus', 'Poor focus', 'Moderate focus', 'Good focus', 'Excellent focus']

const FOG_ICONS: TablerIcon[] = [IconSun, IconSun, IconCloud, IconCloud, IconCloudFog]
const FOG_LABELS = ['Never', 'Rarely', 'Occasionally', 'Quite often', 'Every day']

const QOL_ICONS: TablerIcon[] = [IconMoodSad, IconMoodSad, IconMoodNeutral, IconMoodSmile, IconMoodHappy]
const QOL_LABELS = ['Very poor', 'Poor', 'Fair', 'Good', 'Thriving']

const DAY_LABELS = ['1 day', '2 days', '3 days', '4 days', '5 days', '6 days', '7 days']
const SITTING_LABELS = ['1 hr', '2 hrs', '3 hrs', '4 hrs', '5 hrs', '6 hrs', '7 hrs', '8 hrs', '9 hrs', '10+ hrs']
const FRUIT_VEG_LABELS = ['None', '1–2 servings', '3–4 servings', '5–6 servings', '7+ servings']
const WATER_LABELS = ['0–1 glasses', '2–3 glasses', '4–5 glasses', '6–7 glasses', '8+ glasses']
const PROCESSED_LABELS = ['Never', 'Rarely', '1–2x / week', '3–4x / week', 'Daily']
const ALCOHOL_LABELS = ['Never', '1–2x / month', '1–2x / week', '3–4x / week', 'Daily']
const MEMORY_LABELS = ['Very poor', 'Poor', 'Average', 'Good', 'Sharp']
const WAKING_OPTIONS = ['Rarely', '1–2x / week', '3–4x / week', 'Almost nightly']
const MEAL_OPTIONS = ['Skip meals often', 'Inconsistent', 'Mostly regular', 'Optimal routine']

const GOALS: { id: GoalId; Icon: TablerIcon; title: string; sub: string }[] = [
  { id: 'energy',     Icon: IconBolt,        title: 'Low energy',       sub: 'Fatigue, sluggishness'    },
  { id: 'mood',       Icon: IconMoodSmile,   title: 'Mood & emotions',  sub: 'Stress, anxiety, low mood'},
  { id: 'clarity',    Icon: IconBrain,       title: 'Mental clarity',   sub: 'Focus, memory, brain fog' },
  { id: 'sleep',      Icon: IconMoon,        title: 'Sleep quality',    sub: 'Trouble falling asleep'   },
  { id: 'nutrition',  Icon: IconSalad,       title: 'Nutrition',        sub: 'Diet, digestion, weight'  },
  { id: 'fitness',    Icon: IconRun,         title: 'Physical fitness', sub: 'Strength, endurance'      },
  { id: 'prevention', Icon: IconShieldCheck, title: 'Prevention',       sub: 'Proactive health'         },
  { id: 'wellbeing',  Icon: IconSparkles,    title: 'General wellbeing',sub: 'Feel my best overall'     },
]

// ── Shared primitives ──

function StepHeader({ category, title, sub }: { category: string; title: string; sub: string }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1.5">{category}</p>
      <h2 className="font-serif text-[19px] font-medium text-ink leading-snug mb-1">{title}</h2>
      <p className="text-[13px] text-ink-2 leading-relaxed">{sub}</p>
    </div>
  )
}

function QBlock({ question, hint, children }: { question: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="mb-3">
      <p className="text-[14px] font-medium text-ink mb-1">{question}</p>
      {hint && <p className="text-[12px] text-ink-2 mb-3">{hint}</p>}
      {children}
    </Card>
  )
}

function ChoiceGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2.5">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`border rounded-[20px] px-3 py-1.5 text-[12px] cursor-pointer transition-colors
            ${value === opt ? 'bg-bg border-ink text-ink' : 'bg-card border-ink text-ink hover:bg-bg'}`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function MultiGroup({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2.5">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onToggle(opt)}
          className={`border rounded-[20px] px-3 py-1.5 text-[12px] cursor-pointer transition-colors
            ${selected.includes(opt) ? 'bg-bg border-ink text-ink' : 'bg-card border-ink text-ink hover:bg-bg'}`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function dynIcon(icons: TablerIcon[], value: number) {
  const I = icons[value - 1]
  return <I size={20} className="text-ink" strokeWidth={1.5} />
}

// ── Step components ──

// ── Step 1: Personal & Family History ────────────────────────────────────────

const CONDITIONS = ['Type 2 diabetes', 'Hypertension', 'High cholesterol', 'Hypothyroidism', 'Hyperthyroidism', 'PCOS', 'Autoimmune condition', 'Asthma', 'IBS / IBD', 'Heart disease', 'None']
const FAMILY_CONDITIONS = ['Cardiovascular disease', 'Stroke', 'Type 2 diabetes', 'Cancer', 'Thyroid disorders', 'Autoimmune conditions', 'Mental health conditions', 'Osteoporosis', 'Obesity / metabolic syndrome', 'None known']
const MED_OPTIONS = ['None', 'Medications only', 'Supplements only', 'Both']
const ALLERGY_OPTIONS = ['None known', 'Food allergies', 'Medication allergies', 'Environmental', 'Multiple']
const TOBACCO_OPTIONS = ['Never', 'Former smoker', 'Occasionally', 'Daily']
const MENTAL_OPTIONS = ['No', 'Yes, currently managed', 'Yes, in the past', 'Prefer not to say']

function calcBMI(h: { unit: 'metric' | 'imperial'; heightCm: string; weightKg: string; heightFt: string; heightIn: string; weightLbs: string }): number | null {
  let hm: number, wk: number
  if (h.unit === 'metric') {
    const hcm = parseFloat(h.heightCm); const wkg = parseFloat(h.weightKg)
    if (!hcm || !wkg) return null
    hm = hcm / 100; wk = wkg
  } else {
    const ft = parseFloat(h.heightFt) || 0; const ins = parseFloat(h.heightIn) || 0; const lbs = parseFloat(h.weightLbs)
    if ((!ft && !ins) || !lbs) return null
    hm = (ft * 12 + ins) * 0.0254; wk = lbs * 0.453592
  }
  if (hm <= 0) return null
  const bmi = wk / (hm * hm)
  return (bmi >= 10 && bmi <= 70) ? Math.round(bmi * 10) / 10 : null
}

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight'
  if (bmi < 25)   return 'Healthy weight'
  if (bmi < 30)   return 'Overweight'
  if (bmi < 35)   return 'Obese — Class I'
  if (bmi < 40)   return 'Obese — Class II'
  return 'Obese — Class III'
}

function bmiToPct(bmi: number) { return Math.round(((Math.min(Math.max(bmi, 14), 42) - 14) / 28) * 100) }

function Step1History({ history, setHistory }: { history: HistoryResponses; setHistory: (h: HistoryResponses) => void }) {
  const bmi = calcBMI(history)
  const cat = bmi !== null ? bmiCategory(bmi) : null

  function toggleCondition(v: string) {
    if (v === 'None') {
      setHistory({ ...history, conditions: history.conditions.includes('None') ? [] : ['None'] })
    } else {
      const next = history.conditions.filter(c => c !== 'None')
      setHistory({ ...history, conditions: next.includes(v) ? next.filter(c => c !== v) : [...next, v] })
    }
  }

  function toggleFamily(v: string) {
    if (v === 'None known') {
      setHistory({ ...history, familyHistory: history.familyHistory.includes('None known') ? [] : ['None known'] })
    } else {
      const next = history.familyHistory.filter(c => c !== 'None known')
      setHistory({ ...history, familyHistory: next.includes(v) ? next.filter(c => c !== v) : [...next, v] })
    }
  }

  return (
    <>
      <StepHeader
        category="Personal &amp; Family History"
        title="A little about your health background."
        sub="This helps us understand your starting point and tailor your plan. Everything you share stays private and is never used as a diagnosis."
      />

      {/* Height & Weight */}
      <Card className="mb-3">
        <p className="text-[14px] font-medium text-ink mb-1">Height &amp; weight</p>
        <p className="text-[12px] text-ink-2 italic mb-3">We use this to calculate your BMI as one data point — it doesn't define you.</p>
        <div className="flex mb-4 border border-ink rounded-[8px] overflow-hidden w-fit">
          {(['metric', 'imperial'] as const).map(u => (
            <button
              key={u}
              onClick={() => setHistory({ ...history, unit: u })}
              className={`px-[18px] py-[6px] text-[12px] font-medium cursor-pointer transition-colors
                ${history.unit === u ? 'bg-ink text-bg' : 'bg-card text-ink hover:bg-bg'}`}
            >
              {u.charAt(0).toUpperCase() + u.slice(1)}
            </button>
          ))}
        </div>
        {history.unit === 'metric' ? (
          <div className="flex gap-3 items-end mb-1">
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-[11px] uppercase tracking-[.05em] text-ink-2">Height</span>
              <input type="number" placeholder="170" value={history.heightCm}
                onChange={e => setHistory({ ...history, heightCm: e.target.value })}
                className="border border-border rounded-[10px] px-3 py-2.5 text-[18px] font-medium text-ink bg-card w-full outline-none focus:border-ink transition-colors" />
            </div>
            <span className="text-[13px] text-ink-2 pb-3">cm</span>
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-[11px] uppercase tracking-[.05em] text-ink-2">Weight</span>
              <input type="number" placeholder="70" value={history.weightKg}
                onChange={e => setHistory({ ...history, weightKg: e.target.value })}
                className="border border-border rounded-[10px] px-3 py-2.5 text-[18px] font-medium text-ink bg-card w-full outline-none focus:border-ink transition-colors" />
            </div>
            <span className="text-[13px] text-ink-2 pb-3">kg</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-1">
            <div className="flex gap-3 items-end">
              <div className="flex flex-col gap-1.5 flex-1">
                <span className="text-[11px] uppercase tracking-[.05em] text-ink-2">Feet</span>
                <input type="number" placeholder="5" value={history.heightFt}
                  onChange={e => setHistory({ ...history, heightFt: e.target.value })}
                  className="border border-border rounded-[10px] px-3 py-2.5 text-[18px] font-medium text-ink bg-card w-full outline-none focus:border-ink transition-colors" />
              </div>
              <span className="text-[13px] text-ink-2 pb-3">ft</span>
              <div className="flex flex-col gap-1.5 flex-1">
                <span className="text-[11px] uppercase tracking-[.05em] text-ink-2">Inches</span>
                <input type="number" placeholder="7" value={history.heightIn}
                  onChange={e => setHistory({ ...history, heightIn: e.target.value })}
                  className="border border-border rounded-[10px] px-3 py-2.5 text-[18px] font-medium text-ink bg-card w-full outline-none focus:border-ink transition-colors" />
              </div>
              <span className="text-[13px] text-ink-2 pb-3">in</span>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex flex-col gap-1.5 flex-1">
                <span className="text-[11px] uppercase tracking-[.05em] text-ink-2">Weight</span>
                <input type="number" placeholder="154" value={history.weightLbs}
                  onChange={e => setHistory({ ...history, weightLbs: e.target.value })}
                  className="border border-border rounded-[10px] px-3 py-2.5 text-[18px] font-medium text-ink bg-card w-full outline-none focus:border-ink transition-colors" />
              </div>
              <span className="text-[13px] text-ink-2 pb-3">lbs</span>
            </div>
          </div>
        )}
        {bmi !== null && (
          <div className="mt-3 bg-bg rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-[.06em] text-ink-2 mb-1">Your BMI</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="font-serif text-[42px] font-medium text-ink leading-none">{bmi.toFixed(1)}</span>
              <div>
                <p className="text-[15px] font-semibold text-ink">{cat}</p>
                <p className="text-[12px] text-ink-2">Healthy range: 18.5 – 24.9</p>
              </div>
            </div>
            <div className="relative">
              <div className="h-2 rounded-full w-full" style={{ background: 'linear-gradient(to right,#7FB3D3 0%,#8BC4A8 25%,#D4C56A 50%,#E8A86B 70%,#E07070 85%,#C55A5A 100%)' }} />
              <div className="absolute top-[-4px] w-4 h-4 rounded-full bg-ink border-2 border-bg -translate-x-1/2 transition-all" style={{ left: `${bmiToPct(bmi)}%` }} />
            </div>
            <div className="flex justify-between mt-1.5">
              {['Underweight\n<18.5', 'Normal\n18.5–24.9', 'Overweight\n25–29.9', 'Obese\n30+'].map(l => (
                <span key={l} className="text-[9px] text-ink-2 text-center whitespace-pre-line">{l}</span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Q1: Medical conditions */}
      <QBlock question="Do you have any currently diagnosed medical conditions?" hint="Select all that apply">
        <div className="flex flex-wrap gap-2 mt-2.5">
          {CONDITIONS.map(opt => (
            <button key={opt} onClick={() => toggleCondition(opt)}
              className={`border rounded-[20px] px-3 py-1.5 text-[12px] cursor-pointer transition-colors
                ${history.conditions.includes(opt) ? 'bg-bg border-ink text-ink' : 'bg-card border-ink text-ink hover:bg-bg'}`}>
              {opt}
            </button>
          ))}
        </div>
        <textarea
          value={history.conditionsOther}
          onChange={e => setHistory({ ...history, conditionsOther: e.target.value })}
          placeholder="Any other conditions not listed above — feel free to describe here…"
          className="w-full mt-3 border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-ink bg-card placeholder:text-ink-2/50 outline-none focus:border-ink resize-none min-h-[52px] transition-colors"
        />
      </QBlock>

      {/* Q2: Medications */}
      <QBlock question="Are you currently taking any medications or supplements?">
        <div className="flex flex-wrap gap-2 mt-2.5">
          {MED_OPTIONS.map(opt => (
            <button key={opt} onClick={() => setHistory({ ...history, medications: opt })}
              className={`border rounded-[20px] px-3 py-1.5 text-[12px] cursor-pointer transition-colors
                ${history.medications === opt ? 'bg-bg border-ink text-ink' : 'bg-card border-ink text-ink hover:bg-bg'}`}>
              {opt}
            </button>
          ))}
        </div>
        <textarea
          value={history.medicationsText}
          onChange={e => setHistory({ ...history, medicationsText: e.target.value })}
          placeholder="List any medications or supplements here — e.g. metformin, vitamin D, omega-3…"
          className="w-full mt-3 border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-ink bg-card placeholder:text-ink-2/50 outline-none focus:border-ink resize-none min-h-[52px] transition-colors"
        />
      </QBlock>

      {/* Q3: Allergies */}
      <QBlock question="Do you have any known allergies?" hint="Food, medication, environmental or other">
        <div className="flex flex-wrap gap-2 mt-2.5">
          {ALLERGY_OPTIONS.map(opt => (
            <button key={opt} onClick={() => setHistory({ ...history, allergies: opt })}
              className={`border rounded-[20px] px-3 py-1.5 text-[12px] cursor-pointer transition-colors
                ${history.allergies === opt ? 'bg-bg border-ink text-ink' : 'bg-card border-ink text-ink hover:bg-bg'}`}>
              {opt}
            </button>
          ))}
        </div>
        <textarea
          value={history.allergiesText}
          onChange={e => setHistory({ ...history, allergiesText: e.target.value })}
          placeholder="Please list any specific allergies here…"
          className="w-full mt-3 border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-ink bg-card placeholder:text-ink-2/50 outline-none focus:border-ink resize-none min-h-[52px] transition-colors"
        />
      </QBlock>

      {/* Q4: Tobacco */}
      <QBlock question="Do you currently use tobacco or smoke?">
        <div className="flex flex-wrap gap-2 mt-2.5">
          {TOBACCO_OPTIONS.map(opt => (
            <button key={opt} onClick={() => setHistory({ ...history, tobacco: opt })}
              className={`border rounded-[20px] px-3 py-1.5 text-[12px] cursor-pointer transition-colors
                ${history.tobacco === opt ? 'bg-bg border-ink text-ink' : 'bg-card border-ink text-ink hover:bg-bg'}`}>
              {opt}
            </button>
          ))}
        </div>
      </QBlock>

      {/* Q5: Mental health */}
      <QBlock question="Have you ever been diagnosed with or treated for a mental health condition?">
        <div className="flex flex-wrap gap-2 mt-2.5">
          {MENTAL_OPTIONS.map(opt => (
            <button key={opt} onClick={() => setHistory({ ...history, mentalHealth: opt })}
              className={`border rounded-[20px] px-3 py-1.5 text-[12px] cursor-pointer transition-colors
                ${history.mentalHealth === opt ? 'bg-bg border-ink text-ink' : 'bg-card border-ink text-ink hover:bg-bg'}`}>
              {opt}
            </button>
          ))}
        </div>
      </QBlock>

      {/* Q6: Family history */}
      <QBlock question="Does anyone in your immediate family (parents or siblings) have a history of any of the following?" hint="Select all that apply">
        <div className="flex flex-wrap gap-2 mt-2.5">
          {FAMILY_CONDITIONS.map(opt => (
            <button key={opt} onClick={() => toggleFamily(opt)}
              className={`border rounded-[20px] px-3 py-1.5 text-[12px] cursor-pointer transition-colors
                ${history.familyHistory.includes(opt) ? 'bg-bg border-ink text-ink' : 'bg-card border-ink text-ink hover:bg-bg'}`}>
              {opt}
            </button>
          ))}
        </div>
        <textarea
          value={history.familyHistoryOther}
          onChange={e => setHistory({ ...history, familyHistoryOther: e.target.value })}
          placeholder="Any additional family history details — condition, which relative, age of onset if known…"
          className="w-full mt-3 border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-ink bg-card placeholder:text-ink-2/50 outline-none focus:border-ink resize-none min-h-[52px] transition-colors"
        />
      </QBlock>
    </>
  )
}

function Step2Goals({ goals, setGoals }: { goals: GoalId[]; setGoals: (g: GoalId[]) => void }) {
  function toggle(id: GoalId) {
    setGoals(goals.includes(id) ? goals.filter(g => g !== id) : [...goals, id])
  }
  return (
    <>
      <StepHeader
        category="Getting started"
        title="What brought you here today?"
        sub="Select everything that resonates — there are no wrong answers."
      />
      <div className="grid grid-cols-2 gap-2">
        {GOALS.map(({ id, Icon, title, sub }) => {
          const sel = goals.includes(id)
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={`text-left border rounded-xl p-4 cursor-pointer transition-colors
                ${sel ? 'bg-bg border-ink' : 'bg-card border-ink hover:bg-bg'}`}
            >
              <Icon size={18} className="text-ink-2 mb-1.5" strokeWidth={1.5} />
              <p className="text-[13px] font-medium text-ink">{title}</p>
              <p className="text-[11px] text-ink-2 mt-0.5">{sub}</p>
            </button>
          )
        })}
      </div>
    </>
  )
}

function Step3Stress({ stress, setStress }: { stress: StressResponses; setStress: (s: StressResponses) => void }) {
  return (
    <>
      <StepHeader
        category="Mental wellness · Stress"
        title="How has stress been showing up lately?"
        sub="Think about the past month and select the option that feels most true."
      />
      <QBlock question="How often have you felt unable to control important things in your life?">
        <Slider min={1} max={5} value={stress.q1} onChange={v => setStress({ ...stress, q1: v })}
          leftLabel="Never" rightLabel="Very often"
          answerLabel={STRESS_LABELS[stress.q1 - 1]} icon={dynIcon(STRESS_ICONS, stress.q1)} />
      </QBlock>
      <QBlock
        question="How often have you felt confident handling personal problems?"
        hint="Positively-worded — higher score reflects stronger resilience"
      >
        <Slider min={1} max={5} value={stress.q2} onChange={v => setStress({ ...stress, q2: v })}
          leftLabel="Never" rightLabel="Very often"
          answerLabel={STRESS_LABELS[stress.q2 - 1]} icon={dynIcon(STRESS_ICONS_POS, stress.q2)} />
      </QBlock>
      <QBlock question="How often have you felt difficulties piling up beyond your control?">
        <Slider min={1} max={5} value={stress.q3} onChange={v => setStress({ ...stress, q3: v })}
          leftLabel="Never" rightLabel="Very often"
          answerLabel={STRESS_LABELS[stress.q3 - 1]} icon={dynIcon(STRESS_ICONS, stress.q3)} />
      </QBlock>
      <QBlock
        question="How often have you felt things were going your way?"
        hint="Positively-worded — higher score means better mood and flow"
      >
        <Slider min={1} max={5} value={stress.q4} onChange={v => setStress({ ...stress, q4: v })}
          leftLabel="Never" rightLabel="Very often"
          answerLabel={STRESS_LABELS[stress.q4 - 1]} icon={dynIcon(STRESS_ICONS_POS, stress.q4)} />
      </QBlock>
    </>
  )
}

function Step4Activity({ activity, setActivity }: { activity: ActivityResponses; setActivity: (a: ActivityResponses) => void }) {
  return (
    <>
      <StepHeader
        category="Physical wellness · Activity"
        title="How does your body move through the week?"
        sub="Think about a typical week over the past month."
      />
      <QBlock question="Days per week you do vigorous activity" hint="e.g. running, HIIT, cycling fast">
        <Slider min={1} max={7} value={activity.vigorous} onChange={v => setActivity({ ...activity, vigorous: v })}
          leftLabel="1 day" rightLabel="Every day"
          answerLabel={DAY_LABELS[activity.vigorous - 1]} icon={<IconFlame size={20} className="text-ink" strokeWidth={1.5} />} />
      </QBlock>
      <QBlock question="Days per week you do moderate activity" hint="e.g. brisk walking, yoga, light cycling">
        <Slider min={1} max={7} value={activity.moderate} onChange={v => setActivity({ ...activity, moderate: v })}
          leftLabel="1 day" rightLabel="Every day"
          answerLabel={DAY_LABELS[activity.moderate - 1]} icon={<IconWalk size={20} className="text-ink" strokeWidth={1.5} />} />
      </QBlock>
      <QBlock question="How would you rate your energy during physical activity?">
        <Slider min={1} max={5} value={activity.energy} onChange={v => setActivity({ ...activity, energy: v })}
          leftLabel="Very low" rightLabel="Excellent"
          answerLabel={ENERGY_LABELS[activity.energy - 1]} icon={dynIcon(ENERGY_ICONS, activity.energy)} />
      </QBlock>
      <QBlock question="Hours per day spent sitting" hint="Desk work, commute, screens">
        <Slider min={1} max={10} value={activity.sitting} onChange={v => setActivity({ ...activity, sitting: v })}
          leftLabel="1 hr" rightLabel="10+ hrs"
          answerLabel={SITTING_LABELS[activity.sitting - 1]} icon={<IconArmchair size={20} className="text-ink" strokeWidth={1.5} />} />
      </QBlock>
    </>
  )
}

function Step5Sleep({ sleep, setSleep }: { sleep: SleepResponses; setSleep: (s: SleepResponses) => void }) {
  const wakingStr = WAKING_OPTIONS[sleep.waking]
  return (
    <>
      <StepHeader
        category="Physical wellness · Sleep"
        title="Let's talk about your sleep."
        sub="Quality rest is one of the most powerful levers for your wellbeing."
      />
      <QBlock question="Average hours of sleep per night">
        <Slider min={1} max={6} value={sleep.duration} onChange={v => setSleep({ ...sleep, duration: v })}
          leftLabel="3 hrs or less" rightLabel="10+ hrs"
          answerLabel={SLEEP_LABELS[sleep.duration - 1]} icon={dynIcon(SLEEP_ICONS, sleep.duration)} />
      </QBlock>
      <QBlock question="How long does it take to fall asleep?">
        <Slider min={1} max={6} value={sleep.latency} onChange={v => setSleep({ ...sleep, latency: v })}
          leftLabel="Instantly" rightLabel="60+ min"
          answerLabel={LATENCY_LABELS[sleep.latency - 1]} icon={dynIcon(LATENCY_ICONS, sleep.latency)} />
      </QBlock>
      <QBlock question="How rested do you feel when you wake up?">
        <Slider min={1} max={5} value={sleep.restedness} onChange={v => setSleep({ ...sleep, restedness: v })}
          leftLabel="Exhausted" rightLabel="Fully refreshed"
          answerLabel={RESTED_LABELS[sleep.restedness - 1]} icon={dynIcon(RESTED_ICONS, sleep.restedness)} />
      </QBlock>
      <QBlock question="How often do you wake during the night?">
        <ChoiceGroup
          options={WAKING_OPTIONS}
          value={wakingStr}
          onChange={v => setSleep({ ...sleep, waking: WAKING_OPTIONS.indexOf(v) as 0 | 1 | 2 | 3 })}
        />
      </QBlock>
    </>
  )
}

function Step6Nutrition({ nutrition, setNutrition }: { nutrition: NutritionResponses; setNutrition: (n: NutritionResponses) => void }) {
  const mealStr = MEAL_OPTIONS[nutrition.mealRegularity - 1]
  return (
    <>
      <StepHeader
        category="Nutrition pillar"
        title="How's your relationship with food?"
        sub="No judgement — just an honest snapshot of your typical week."
      />
      <QBlock question="Servings of vegetables or fruit per day" hint="1 serving ≈ 1 medium fruit, ½ cup cooked veg, or 1 cup leafy greens. WHO recommends 5+ daily.">
        <Slider min={1} max={5} value={nutrition.fruitVeg} onChange={v => setNutrition({ ...nutrition, fruitVeg: v })}
          leftLabel="None" rightLabel="7+ servings"
          answerLabel={FRUIT_VEG_LABELS[nutrition.fruitVeg - 1]} icon={<IconLeaf size={20} className="text-ink" strokeWidth={1.5} />} />
      </QBlock>
      <QBlock question="Glasses of water per day">
        <Slider min={1} max={5} value={nutrition.water} onChange={v => setNutrition({ ...nutrition, water: v })}
          leftLabel="0–1 glasses" rightLabel="8+ glasses"
          answerLabel={WATER_LABELS[nutrition.water - 1]} icon={<IconDroplet size={20} className="text-ink" strokeWidth={1.5} />} />
      </QBlock>
      <QBlock question="How often do you eat processed or fast food?">
        <Slider min={1} max={5} value={nutrition.processed} onChange={v => setNutrition({ ...nutrition, processed: v })}
          leftLabel="Never" rightLabel="Daily"
          answerLabel={PROCESSED_LABELS[nutrition.processed - 1]} icon={<IconBurger size={20} className="text-ink" strokeWidth={1.5} />} />
      </QBlock>
      <QBlock question="How regular are your meal times?" hint="Skipping meals can impact blood sugar and energy">
        <ChoiceGroup
          options={MEAL_OPTIONS}
          value={mealStr}
          onChange={v => setNutrition({ ...nutrition, mealRegularity: MEAL_OPTIONS.indexOf(v) + 1 })}
        />
      </QBlock>
      <QBlock question="How often do you consume alcohol?">
        <Slider min={1} max={5} value={nutrition.alcohol} onChange={v => setNutrition({ ...nutrition, alcohol: v })}
          leftLabel="Never" rightLabel="Daily"
          answerLabel={ALCOHOL_LABELS[nutrition.alcohol - 1]} icon={<IconGlass size={20} className="text-ink" strokeWidth={1.5} />} />
      </QBlock>
    </>
  )
}

// Frequency scale reused for the two new cognition questions (same as stress scale)
const FREQ_ICONS = STRESS_ICONS
const FREQ_LABELS = STRESS_LABELS

function Step7Cognition({ cognition, setCognition }: { cognition: CognitionResponses; setCognition: (c: CognitionResponses) => void }) {
  return (
    <>
      <StepHeader
        category="Mental wellness · Cognition"
        title="How's your mind been performing?"
        sub="These questions help us understand your mental sharpness and clarity."
      />
      <QBlock question="Ability to focus on tasks for extended periods" hint="1 = cannot focus; 5 = deep, sustained concentration">
        <Slider min={1} max={5} value={cognition.focus} onChange={v => setCognition({ ...cognition, focus: v })}
          leftLabel="Cannot focus" rightLabel="Excellent focus"
          answerLabel={FOCUS_LABELS[cognition.focus - 1]} icon={dynIcon(FOCUS_ICONS, cognition.focus)} />
      </QBlock>
      <QBlock question="How often do you experience brain fog or mental fatigue?" hint="Higher = more frequent fog (reverse-scored)">
        <Slider min={1} max={5} value={cognition.fog} onChange={v => setCognition({ ...cognition, fog: v })}
          leftLabel="Never" rightLabel="Every day"
          answerLabel={FOG_LABELS[cognition.fog - 1]} icon={dynIcon(FOG_ICONS, cognition.fog)} />
      </QBlock>
      <QBlock question="How would you rate your short-term memory?">
        <Slider min={1} max={5} value={cognition.memory} onChange={v => setCognition({ ...cognition, memory: v })}
          leftLabel="Very poor" rightLabel="Sharp"
          answerLabel={MEMORY_LABELS[cognition.memory - 1]} icon={<IconDatabase size={20} className="text-ink" strokeWidth={1.5} />} />
      </QBlock>
      <QBlock question="How often do you easily lose your train of thought mid-sentence?">
        <Slider min={1} max={5} value={cognition.trainOfThought} onChange={v => setCognition({ ...cognition, trainOfThought: v })}
          leftLabel="Never" rightLabel="Very often"
          answerLabel={FREQ_LABELS[cognition.trainOfThought - 1]} icon={dynIcon(FREQ_ICONS, cognition.trainOfThought)} />
      </QBlock>
      <QBlock question="How often do you struggle to find the right word for a common object while speaking?">
        <Slider min={1} max={5} value={cognition.wordFinding} onChange={v => setCognition({ ...cognition, wordFinding: v })}
          leftLabel="Never" rightLabel="Very often"
          answerLabel={FREQ_LABELS[cognition.wordFinding - 1]} icon={dynIcon(FREQ_ICONS, cognition.wordFinding)} />
      </QBlock>
    </>
  )
}

function Step8Symptoms({ symptoms, setSymptoms }: { symptoms: SymptomsResponses; setSymptoms: (s: SymptomsResponses) => void }) {
  const PHYSICAL = ['Headaches', 'Muscle tension', 'Bloating', 'Low libido', 'Hair loss', 'Skin issues', 'None']
  const ENERGY_MOOD = ['Afternoon crashes', 'Irritability', 'Low motivation', 'Anxious thoughts', 'Overwhelmed', 'None']

  function togglePhysical(v: string) {
    if (v === 'None') {
      setSymptoms({ ...symptoms, physical: symptoms.physical.includes('None') ? [] : ['None'] })
    } else {
      const next = symptoms.physical.filter(s => s !== 'None')
      setSymptoms({ ...symptoms, physical: next.includes(v) ? next.filter(s => s !== v) : [...next, v] })
    }
  }

  function toggleEnergyMood(v: string) {
    if (v === 'None') {
      setSymptoms({ ...symptoms, energyMood: symptoms.energyMood.includes('None') ? [] : ['None'] })
    } else {
      const next = symptoms.energyMood.filter(s => s !== 'None')
      setSymptoms({ ...symptoms, energyMood: next.includes(v) ? next.filter(s => s !== v) : [...next, v] })
    }
  }

  return (
    <>
      <StepHeader
        category="Final check-in · Symptoms"
        title="Any symptoms you've been noticing?"
        sub="Select anything present in the last 4 weeks."
      />
      <QBlock question="Physical">
        <MultiGroup options={PHYSICAL} selected={symptoms.physical} onToggle={togglePhysical} />
      </QBlock>
      <QBlock question="Energy & mood">
        <MultiGroup options={ENERGY_MOOD} selected={symptoms.energyMood} onToggle={toggleEnergyMood} />
      </QBlock>
      <QBlock question="Any other symptoms you've been experiencing?">
        <textarea
          value={symptoms.otherSymptoms}
          onChange={e => setSymptoms({ ...symptoms, otherSymptoms: e.target.value })}
          placeholder="Describe anything else you've noticed — no detail is too small…"
          className="w-full mt-2 border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-ink bg-bg placeholder:text-ink-2/50 outline-none focus:border-ink resize-none min-h-[80px] transition-colors"
        />
      </QBlock>
      <QBlock question="Overall quality of life right now">
        <Slider min={1} max={5} value={symptoms.qol} onChange={v => setSymptoms({ ...symptoms, qol: v })}
          leftLabel="Very poor" rightLabel="Thriving"
          answerLabel={QOL_LABELS[symptoms.qol - 1]} icon={dynIcon(QOL_ICONS, symptoms.qol)} />
      </QBlock>
    </>
  )
}

// ── Questionnaire shell ──

const TOTAL = 8

export default function QuestionnairePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)

  const [history,   setHistory]   = useState<HistoryResponses>({
    unit: 'metric', heightCm: '', weightKg: '', heightFt: '', heightIn: '', weightLbs: '',
    conditions: ['None'], conditionsOther: '',
    medications: 'None', medicationsText: '',
    allergies: 'None known', allergiesText: '',
    tobacco: 'Never', mentalHealth: 'No',
    familyHistory: ['None known'], familyHistoryOther: '',
  })
  const [goals,     setGoals]     = useState<GoalId[]>([])
  const [stress,    setStress]    = useState<StressResponses>({ q1: 1, q2: 1, q3: 1, q4: 1 })
  const [activity,  setActivity]  = useState<ActivityResponses>({ vigorous: 1, moderate: 1, energy: 1, sitting: 1 })
  const [sleep,     setSleep]     = useState<SleepResponses>({ duration: 1, latency: 1, restedness: 1, waking: 0 })
  const [nutrition, setNutrition] = useState<NutritionResponses>({ fruitVeg: 1, water: 1, processed: 1, mealRegularity: 1, alcohol: 1 })
  const [cognition, setCognition] = useState<CognitionResponses>({ focus: 1, fog: 1, memory: 1, trainOfThought: 1, wordFinding: 1 })
  const [symptoms,  setSymptoms]  = useState<SymptomsResponses>({ physical: [], energyMood: [], otherSymptoms: '', qol: 1 })

  function handleFinish() {
    const answers: QuestionnaireResponses = { history, goals, stress, activity, sleep, nutrition, cognition, symptoms }
    saveQuestionnaire(answers)
    router.push('/labs/entry')
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      <BrandHeader stepLabel={`Step ${step} of ${TOTAL}`} />
      <ProgressBar value={Math.round((step / TOTAL) * 100)} className="mx-6 mt-1.5" />

      <div className="px-6 pt-5">
        {step === 1 && <Step1History  history={history}     setHistory={setHistory}     />}
        {step === 2 && <Step2Goals    goals={goals}         setGoals={setGoals}         />}
        {step === 3 && <Step3Stress   stress={stress}       setStress={setStress}       />}
        {step === 4 && <Step4Activity activity={activity}   setActivity={setActivity}   />}
        {step === 5 && <Step5Sleep    sleep={sleep}         setSleep={setSleep}         />}
        {step === 6 && <Step6Nutrition nutrition={nutrition} setNutrition={setNutrition} />}
        {step === 7 && <Step7Cognition cognition={cognition} setCognition={setCognition} />}
        {step === 8 && <Step8Symptoms symptoms={symptoms}   setSymptoms={setSymptoms}   />}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-bg border-t border-border px-6 py-4 flex gap-3">
        {step > 1 && (
          <Button variant="outline" onClick={() => setStep(s => s - 1)}>
            Back
          </Button>
        )}
        <Button
          variant={step === TOTAL ? 'filled' : 'outline'}
          className="flex-1"
          onClick={step === TOTAL ? handleFinish : () => setStep(s => s + 1)}
        >
          {step === TOTAL ? 'See my results' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
