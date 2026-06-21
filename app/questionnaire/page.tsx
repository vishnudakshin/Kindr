'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconMoodHappy, IconMoodSmile, IconMoodNeutral, IconMoodNervous, IconMoodSad,
  IconFlame, IconWalk, IconArmchair, IconBarbell,
  IconBrain, IconSparkles,
} from '@tabler/icons-react'
import type { FC } from 'react'
import { BrandHeader } from '@/components/ui/BrandHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Slider } from '@/components/ui/Slider'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { saveQuestionnaire } from '@/lib/data'
import type {
  QuestionnaireResponses,
  HistoryResponses, StressResponses, ActivityResponses, SleepResponses,
  NutritionResponses, CognitionResponses, WellbeingResponses, SymptomsResponses,
} from '@/lib/types'

type TablerIcon = FC<{ size?: number; className?: string; strokeWidth?: number }>

// ── Question text constants ───────────────────────────────────────────────────

// 5 combined questions → 10 PSS-10 items internally (scoring.ts untouched).
// Each question writes the same answer to all its `indices`; items [1] and [5] remain at 0.
interface CombinedStressQ { text: string; positive: boolean; indices: number[] }
const COMBINED_STRESS_QUESTIONS: CombinedStressQ[] = [
  { text: "How often have you been upset or angered by things you couldn't control or predict?", positive: false, indices: [0, 8] },
  { text: 'How often have you felt nervous or stressed?',                                        positive: false, indices: [2] },
  { text: 'How often have you felt confident to handle the challenges in your life?',            positive: true,  indices: [3, 6] },
  { text: 'How often have you felt that things were going well and you were on top of things?', positive: true,  indices: [4, 7] },
  { text: 'How often have you felt that difficulties were piling up beyond what you could handle?', positive: false, indices: [9] },
]
const PSS_LABELS = ['Never', 'Rarely', 'Sometimes', 'Often', 'Very often']

// PROMIS Sleep Disturbance 8a — official item wording and per-item response options.
// Items have mixed response scales; value stored is always the disturbance score (1=least, 5=most).

const _SLEEP_STANDARD = [
  { label: 'Not at all',   value: 1 },
  { label: 'A little bit', value: 2 },
  { label: 'Somewhat',     value: 3 },
  { label: 'Quite a bit',  value: 4 },
  { label: 'Very much',    value: 5 },
]
const _SLEEP_REVERSED = [       // "Not at all" = most disturbance (5), "Very much" = least (1)
  { label: 'Not at all',   value: 5 },
  { label: 'A little bit', value: 4 },
  { label: 'Somewhat',     value: 3 },
  { label: 'Quite a bit',  value: 2 },
  { label: 'Very much',    value: 1 },
]

// 5 combined questions → 8 PROMIS items internally (scoring.ts untouched).
// Each question writes the same answer to all its `indices`; option scales match within each pair.
interface CombinedSleepQ { text: string; options: { label: string; value: number }[]; indices: number[] }
const COMBINED_SLEEP_QUESTIONS: CombinedSleepQ[] = [
  { text: 'My sleep quality was',
    options: [{ label: 'Very poor', value: 5 }, { label: 'Poor', value: 4 }, { label: 'Fair', value: 3 }, { label: 'Good', value: 2 }, { label: 'Very good', value: 1 }],
    indices: [0] },
  { text: 'My sleep left me feeling refreshed and satisfied.',
    options: _SLEEP_REVERSED, indices: [1, 7] },
  { text: 'I had difficulty falling asleep.',
    options: _SLEEP_STANDARD, indices: [2, 3] },
  { text: 'My sleep was restless.',
    options: _SLEEP_STANDARD, indices: [4] },
  { text: 'I worried about not being able to fall asleep.',
    options: _SLEEP_STANDARD, indices: [5, 6] },
]

// 5 display questions → 8 STC items internally (scoring.ts untouched).
// Combined questions write the same option index (0/1/2) to all their stc[] indices.
interface StcDisplayItem { text: string; hint?: string; options: [string, string, string]; indices: number[] }
const STC_DISPLAY: StcDisplayItem[] = [
  { text: 'How often do you eat breakfast?',
    options: ['Daily', 'Most days', 'Rarely/never'], indices: [0] },
  { text: 'How often do you eat 5+ servings of fruit and vegetables per day?',
    options: ['Daily', 'Sometimes', 'Rarely/never'], indices: [1] },
  { text: 'How often do you eat whole grains or high-fibre foods?',
    hint: 'e.g. oats, brown rice, millets (ragi, kambu, thinai), whole wheat bread, dal',
    options: ['Daily', 'Sometimes', 'Rarely/never'], indices: [2] },
  { text: 'How often do you eat fast food or processed food?',
    options: ['Rarely/never', 'Sometimes', 'Often/daily'], indices: [3, 4, 7] },
  { text: 'How often do you consume sugary beverages (juice, soda, sports drinks) & desserts?',
    options: ['Rarely/never', 'Sometimes', 'Daily'], indices: [5, 6] },
]

// AUDIT-C Q3 removed — Q2 (drink quantity) covers the binge dimension. auditC[2] stays at 0.
const AUDITC_QUESTIONS = [
  'How often do you have a drink containing alcohol?',
  'How many standard drinks do you have on a typical day when you are drinking?',
]
const AUDITC_RESPONSES = [
  ['Never', 'Monthly or less', '2–4×/month', '2–3×/week', '4+×/week'],
  ['1–2', '3–4', '5–6', '7–9', '10+'],
]

// PROMIS Cognitive Function Abilities 4a — official item wording (v2.0, Jan 2020).
// All items: Not at all(1) → Very much(5); higher = better function.
const COG_ITEMS = [
  'My mind has been as sharp as usual.',
  'My memory has been as good as usual.',
  'My thinking has been as fast as usual.',
  'I have been able to keep track of what I am doing, even if I am interrupted.',
]
const COG_LABELS = ['', 'Not at all', 'A little bit', 'Somewhat', 'Quite a bit', 'Very much']

const WHO5_ITEMS = [
  'I have felt cheerful and in good spirits.',
  'I have felt calm and relaxed.',
  'I have felt active and vigorous.',
  'I woke up feeling fresh and rested.',
  'My daily life has been filled with things that interest me.',
]
const WHO5_LABELS = ['At no time', 'Some of the time', 'Less than half the time', 'More than half the time', 'Most of the time', 'All of the time']

// ── Shared primitives ─────────────────────────────────────────────────────────

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

function pssIcon(v: number, positive: boolean): React.ReactNode {
  const icons: TablerIcon[] = positive
    ? [IconMoodSad, IconMoodNervous, IconMoodNeutral, IconMoodSmile, IconMoodHappy]
    : [IconMoodHappy, IconMoodSmile, IconMoodNeutral, IconMoodNervous, IconMoodSad]
  const I = icons[v] ?? IconMoodNeutral
  return <I size={20} className="text-ink" strokeWidth={1.5} />
}

// ── Step 1: History ──────────────────────────────────────────────────────────

const CONDITIONS = ['Type 2 diabetes', 'Hypertension', 'High cholesterol', 'Hypothyroidism', 'Hyperthyroidism', 'PCOS', 'Autoimmune condition', 'Asthma', 'IBS / IBD', 'Heart disease', 'None']
const FAMILY_CONDITIONS = ['Cardiovascular disease', 'Stroke', 'Type 2 diabetes', 'Cancer', 'Thyroid disorders', 'Autoimmune conditions', 'Mental health conditions', 'Osteoporosis', 'Obesity / metabolic syndrome', 'None known']
const MED_OPTIONS = ['None', 'Medications only', 'Supplements only', 'Both']
const ALLERGY_OPTIONS = ['None known', 'Food allergies', 'Medication allergies', 'Environmental', 'Multiple']
const DIET_PREF_OPTIONS = ['Omnivore','Vegetarian','Vegan','Pescatarian','Keto','Paleo','Gluten-free','Dairy-free']
const TOBACCO_OPTIONS = ['Never', 'Former smoker', 'Occasionally', 'Daily']
const MENTAL_OPTIONS = ['No', 'Yes', 'Prefer not to say']

function calcBMI(h: HistoryResponses): number | null {
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
  if (bmi < 23)   return 'Healthy weight'
  if (bmi < 25)   return 'Overweight'
  return 'Obese'
}

function bmiToPct(bmi: number) { return Math.round(((Math.min(Math.max(bmi, 14), 42) - 14) / 28) * 100) }

function WaistBlock({ history, setHistory }: { history: HistoryResponses; setHistory: (h: HistoryResponses) => void }) {
  const [inches, setInches] = useState('')

  function handleInchChange(val: string) {
    setInches(val)
    const n = parseFloat(val)
    if (!isNaN(n) && n > 0) {
      setHistory({ ...history, waistCm: String(Math.round(n * 2.54)) })
    }
  }

  function handleCmChange(val: string) {
    setHistory({ ...history, waistCm: val })
    const n = parseFloat(val)
    if (!isNaN(n) && n > 0) {
      setInches(String(Math.round((n / 2.54) * 10) / 10))
    } else {
      setInches('')
    }
  }

  return (
    <QBlock question="Waist circumference" hint="Measure at the level of your navel — used to calculate your waist-to-height ratio.">
      <div className="flex items-end gap-4 mt-1">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[.05em] text-ink-2">Centimetres</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number" placeholder="e.g. 85" min={40} max={200}
              value={history.waistCm}
              onChange={e => handleCmChange(e.target.value)}
              className="border border-border rounded-[10px] px-3 py-2.5 text-[18px] font-medium text-ink bg-card w-28 outline-none focus:border-ink transition-colors"
            />
            <span className="text-[13px] text-ink-2">cm</span>
          </div>
        </div>
        <div className="flex items-center pb-3 text-[12px] text-ink-2 select-none">or</div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[.05em] text-ink-2">Inches</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number" placeholder="e.g. 33" min={15} max={80}
              value={inches}
              onChange={e => handleInchChange(e.target.value)}
              className="border border-border rounded-[10px] px-3 py-2.5 text-[18px] font-medium text-ink bg-card w-28 outline-none focus:border-ink transition-colors"
            />
            <span className="text-[13px] text-ink-2">in</span>
          </div>
        </div>
      </div>
      {history.waistCm && inches && (
        <p className="text-[11px] text-ink-2 mt-2">{history.waistCm} cm = {inches} in</p>
      )}
    </QBlock>
  )
}

function BloodPressureBlock({ history, setHistory }: { history: HistoryResponses; setHistory: (h: HistoryResponses) => void }) {
  const sys = history.bpSystolic ?? 0
  const dia = history.bpDiastolic ?? 0
  const both = sys > 0 && dia > 0

  function category(): { label: string; color: string } | null {
    if (!both) return null
    if (sys < 120 && dia < 80)  return { label: 'Normal',            color: '#5A7A50' }
    if (sys < 130 && dia < 80)  return { label: 'Elevated',          color: '#B8842A' }
    if (sys < 140 || dia < 90)  return { label: 'High — Stage 1',    color: '#B8842A' }
    return                             { label: 'High — Stage 2',    color: '#A63030' }
  }

  const cat = category()

  return (
    <QBlock question="Resting blood pressure" hint="After 5 minutes seated and at rest. Your most recent reading is fine.">
      <div className="flex items-end gap-3 mt-1">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[.05em] text-ink-2">Systolic</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number" placeholder="120" min={60} max={220}
              value={history.bpSystolic ?? ''}
              onChange={e => setHistory({ ...history, bpSystolic: e.target.value ? parseFloat(e.target.value) : null })}
              className="border border-border rounded-[10px] px-3 py-2.5 text-[18px] font-medium text-ink bg-card w-24 outline-none focus:border-ink transition-colors"
            />
          </div>
        </div>
        <span className="text-[22px] text-ink-2 pb-2.5 select-none">/</span>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[.05em] text-ink-2">Diastolic</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number" placeholder="80" min={40} max={140}
              value={history.bpDiastolic ?? ''}
              onChange={e => setHistory({ ...history, bpDiastolic: e.target.value ? parseFloat(e.target.value) : null })}
              className="border border-border rounded-[10px] px-3 py-2.5 text-[18px] font-medium text-ink bg-card w-24 outline-none focus:border-ink transition-colors"
            />
          </div>
        </div>
        <span className="text-[13px] text-ink-2 pb-3">mmHg</span>
      </div>
      {both && (
        <div className="flex items-center gap-2 mt-2">
          <span className="font-medium text-[13px] text-ink">{sys}/{dia}</span>
          {cat && <span className="text-[12px] font-medium" style={{ color: cat.color }}>{cat.label}</span>}
        </div>
      )}
    </QBlock>
  )
}

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

      {/* Age */}
      <QBlock question="How old are you?">
        <input
          type="number" placeholder="e.g. 35" min={16} max={120}
          value={history.age ?? ''}
          onChange={e => setHistory({ ...history, age: e.target.value ? parseInt(e.target.value, 10) : null })}
          className="border border-border rounded-[10px] px-3 py-2.5 text-[18px] font-medium text-ink bg-card w-32 outline-none focus:border-ink transition-colors"
        />
        <span className="ml-2 text-[13px] text-ink-2">years</span>
      </QBlock>

      {/* Sex */}
      <QBlock question="What is your biological sex?">
        <ChoiceGroup
          options={['Male', 'Female', 'Intersex', 'Prefer not to answer']}
          value={history.sex}
          onChange={v => setHistory({ ...history, sex: v })}
        />
      </QBlock>

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
                <p className="text-[12px] text-ink-2">Healthy range: 18.5 – 22.9 (South Asian norm)</p>
              </div>
            </div>
            <div className="relative">
              <div className="h-2 rounded-full w-full" style={{ background: 'linear-gradient(to right,#7FB3D3 0%,#8BC4A8 25%,#D4C56A 50%,#E8A86B 70%,#E07070 85%,#C55A5A 100%)' }} />
              <div className="absolute top-[-4px] w-4 h-4 rounded-full bg-ink border-2 border-bg -translate-x-1/2 transition-all" style={{ left: `${bmiToPct(bmi)}%` }} />
            </div>
          </div>
        )}
      </Card>

      {/* Waist circumference */}
      <WaistBlock history={history} setHistory={setHistory} />

      {/* Blood pressure */}
      <BloodPressureBlock history={history} setHistory={setHistory} />

      {/* Medical conditions */}
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
          placeholder="Any other conditions not listed above…"
          className="w-full mt-3 border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-ink bg-card placeholder:text-ink-2/50 outline-none focus:border-ink resize-none min-h-[52px] transition-colors"
        />
      </QBlock>

      {/* Medications */}
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
          placeholder="List any medications or supplements here…"
          className="w-full mt-3 border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-ink bg-card placeholder:text-ink-2/50 outline-none focus:border-ink resize-none min-h-[52px] transition-colors"
        />
      </QBlock>

      {/* Allergies */}
      <QBlock question="Do you have any known allergies?">
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

      {/* Dietary preferences */}
      <QBlock question="What best describes your dietary approach?" hint="Select all that apply">
        <div className="flex flex-wrap gap-2 mt-2.5">
          {DIET_PREF_OPTIONS.map(opt => (
            <button key={opt}
              onClick={() => {
                const cur = history.dietaryPreferences ?? []
                const next = cur.includes(opt) ? cur.filter(d => d !== opt) : [...cur, opt]
                setHistory({ ...history, dietaryPreferences: next })
              }}
              className={`border rounded-[20px] px-3 py-1.5 text-[12px] cursor-pointer transition-colors
                ${(history.dietaryPreferences ?? []).includes(opt)
                  ? 'bg-bg border-ink text-ink'
                  : 'bg-card border-ink text-ink hover:bg-bg'}`}>
              {opt}
            </button>
          ))}
        </div>
      </QBlock>

      {/* Tobacco */}
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

      {/* Mental health */}
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

      {/* Family history */}
      <QBlock question="Does anyone in your immediate family have a history of any of the following?" hint="Select all that apply">
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
          placeholder="Any additional family history details…"
          className="w-full mt-3 border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-ink bg-card placeholder:text-ink-2/50 outline-none focus:border-ink resize-none min-h-[52px] transition-colors"
        />
      </QBlock>

      {/* Bowel status */}
      <QBlock question="How would you describe your usual bowel movements?" hint="Think about your typical pattern over the past month.">
        <ChoiceGroup
          options={['Regular', 'Irregular / variable', 'Often constipated', 'Loose or frequent']}
          value={history.bowelStatus ?? ''}
          onChange={v => setHistory({ ...history, bowelStatus: v as HistoryResponses['bowelStatus'] })}
        />
      </QBlock>
    </>
  )
}

// ── Step 2: Stress (PSS-10) ────────────────────────────────────────────────────

function Step2Stress({ stress, setStress }: { stress: StressResponses; setStress: (s: StressResponses) => void }) {
  function getCombined(qi: number) {
    return stress.items[COMBINED_STRESS_QUESTIONS[qi].indices[0]]
  }
  function setCombined(qi: number, v: number) {
    const next = [...stress.items]
    for (const idx of COMBINED_STRESS_QUESTIONS[qi].indices) next[idx] = v
    setStress({ items: next })
  }
  return (
    <>
      <StepHeader
        category="Mental wellness · Stress · PSS-10 condensed"
        title="How has stress been showing up lately?"
        sub="Think about the past month. Select how often each statement has applied to you."
      />
      {COMBINED_STRESS_QUESTIONS.map((cq, qi) => (
        <QBlock key={qi} question={cq.text} hint={cq.positive ? 'Positively worded — higher = more resilience' : undefined}>
          <Slider
            min={0} max={4} value={getCombined(qi)}
            onChange={v => setCombined(qi, v)}
            leftLabel="Never" rightLabel="Very often"
            answerLabel={PSS_LABELS[getCombined(qi)]}
            icon={pssIcon(getCombined(qi), cq.positive)}
          />
        </QBlock>
      ))}
    </>
  )
}

// ── Step 3: Activity (EVS) ─────────────────────────────────────────────────────

function Step3Activity({ activity, setActivity }: { activity: ActivityResponses; setActivity: (a: ActivityResponses) => void }) {
  return (
    <>
      <StepHeader
        category="Physical wellness · Activity (IPAQ-SF)"
        title="How does your body move through the week?"
        sub="Think about a typical week over the past month. WHO recommends 150+ min/week of moderate-to-vigorous activity."
      />
      <QBlock question="Days per week you do moderate-to-vigorous exercise" hint="Brisk walking, cycling, swimming, running, gym, sport, etc.">
        <Slider
          min={0} max={7} value={activity.mvpaDays}
          onChange={v => setActivity({ ...activity, mvpaDays: v })}
          leftLabel="0 days" rightLabel="Every day"
          answerLabel={activity.mvpaDays === 0 ? 'None' : activity.mvpaDays === 1 ? '1 day' : `${activity.mvpaDays} days`}
          icon={<IconFlame size={20} className="text-ink" strokeWidth={1.5} />}
        />
      </QBlock>
      <QBlock question="Minutes per session on those days" hint="How long is a typical session?">
        <Slider
          min={0} max={90} value={Math.min(activity.mvpaMinutes, 90)}
          onChange={v => setActivity({ ...activity, mvpaMinutes: v })}
          leftLabel="0 min" rightLabel="90+ min"
          answerLabel={activity.mvpaMinutes === 0 ? 'None' : `${activity.mvpaMinutes} min`}
          icon={<IconWalk size={20} className="text-ink" strokeWidth={1.5} />}
        />
        {activity.mvpaMinutes === 90 && (
          <p className="text-[11px] text-ink-2 mt-1">If you do more than 90 min, enter 90.</p>
        )}
      </QBlock>
      <QBlock question="Days per week you do muscle-strengthening activity" hint="Weights, resistance bands, bodyweight exercises (push-ups, squats, etc.)">
        <Slider
          min={0} max={7} value={activity.strengthDays}
          onChange={v => setActivity({ ...activity, strengthDays: v })}
          leftLabel="0 days" rightLabel="Every day"
          answerLabel={activity.strengthDays === 0 ? 'None' : activity.strengthDays === 1 ? '1 day' : `${activity.strengthDays} days`}
          icon={<IconBarbell size={20} className="text-ink" strokeWidth={1.5} />}
        />
      </QBlock>
      <QBlock question="Hours per day spent sitting" hint="Desk work, commute, TV, screens — total sedentary time">
        <Slider
          min={0} max={16} value={activity.sittingHours}
          onChange={v => setActivity({ ...activity, sittingHours: v })}
          leftLabel="0 hrs" rightLabel="16 hrs"
          answerLabel={`${activity.sittingHours} hrs`}
          icon={<IconArmchair size={20} className="text-ink" strokeWidth={1.5} />}
        />
      </QBlock>
    </>
  )
}

// ── Step 4: Sleep (PROMIS Sleep Disturbance 8a) ────────────────────────────────

function Step4Sleep({ sleep, setSleep }: { sleep: SleepResponses; setSleep: (s: SleepResponses) => void }) {
  function getCombined(qi: number) {
    return sleep.items[COMBINED_SLEEP_QUESTIONS[qi].indices[0]]
  }
  function setCombined(qi: number, v: number) {
    const next = [...sleep.items]
    for (const idx of COMBINED_SLEEP_QUESTIONS[qi].indices) next[idx] = v
    setSleep({ items: next })
  }
  return (
    <>
      <StepHeader
        category="Physical wellness · Sleep · PROMIS 8a condensed"
        title="Let's talk about your sleep over the past week."
        sub="In the past 7 days, select the response that best describes your experience."
      />
      {COMBINED_SLEEP_QUESTIONS.map((cq, qi) => (
        <QBlock key={qi} question={cq.text}>
          <div className="flex flex-wrap gap-2 mt-2.5">
            {cq.options.map(({ label, value }) => (
              <button
                key={label}
                onClick={() => setCombined(qi, value)}
                className={`border rounded-[20px] px-3 py-1.5 text-[12px] cursor-pointer transition-colors
                  ${getCombined(qi) === value
                    ? 'bg-bg border-ink text-ink'
                    : 'bg-card border-ink text-ink hover:bg-bg'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </QBlock>
      ))}
    </>
  )
}

// ── Step 5: Nutrition (STC + AUDIT-C) ─────────────────────────────────────────

function Step5Nutrition({ nutrition, setNutrition }: { nutrition: NutritionResponses; setNutrition: (n: NutritionResponses) => void }) {
  function getStc(di: number) {
    return nutrition.stc[STC_DISPLAY[di].indices[0]]
  }
  function setStc(di: number, v: number) {
    const next = [...nutrition.stc]
    for (const idx of STC_DISPLAY[di].indices) next[idx] = v
    setNutrition({ ...nutrition, stc: next })
  }
  function setAudit(i: number, v: number) {
    setNutrition({ ...nutrition, auditC: nutrition.auditC.map((x, j) => j === i ? v : x) })
  }
  return (
    <>
      <StepHeader
        category="Nutrition · STC + AUDIT-C condensed"
        title="How's your relationship with food and drink?"
        sub="No judgement — just an honest snapshot of your typical patterns."
      />
      <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-3">Diet quality</p>
      {STC_DISPLAY.map((item, di) => (
        <QBlock key={di} question={item.text} hint={item.hint}>
          <div className="flex flex-wrap gap-2 mt-2">
            {item.options.map((label, vi) => (
              <button
                key={vi}
                onClick={() => setStc(di, vi)}
                className={`border rounded-[20px] px-3 py-1.5 text-[12px] cursor-pointer transition-colors
                  ${getStc(di) === vi ? 'bg-bg border-ink text-ink' : 'bg-card border-ink text-ink hover:bg-bg'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </QBlock>
      ))}
      <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mt-4 mb-3">Alcohol (AUDIT-C)</p>
      {AUDITC_QUESTIONS.map((q, i) => (
        <QBlock key={i} question={q}>
          <div className="flex flex-wrap gap-2 mt-2">
            {AUDITC_RESPONSES[i].map((label, vi) => (
              <button
                key={vi}
                onClick={() => setAudit(i, vi)}
                className={`border rounded-[20px] px-3 py-1.5 text-[12px] cursor-pointer transition-colors
                  ${nutrition.auditC[i] === vi ? 'bg-bg border-ink text-ink' : 'bg-card border-ink text-ink hover:bg-bg'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </QBlock>
      ))}
    </>
  )
}

// ── Step 6: Cognition (PROMIS 4a) ──────────────────────────────────────────────

function Step6Cognition({ cognition, setCognition }: { cognition: CognitionResponses; setCognition: (c: CognitionResponses) => void }) {
  function setItem(i: number, v: number) {
    setCognition({ items: cognition.items.map((x, j) => j === i ? v : x) })
  }
  return (
    <>
      <StepHeader
        category="Mental wellness · Cognition (PROMIS 4a)"
        title="How's your mind been performing over the last week?"
        sub="In the past 7 days, how much did each of the following apply? Not at all = 1, Very much = 5."
      />
      {COG_ITEMS.map((q, i) => (
        <QBlock key={i} question={q}>
          <Slider
            min={1} max={5} value={cognition.items[i]}
            onChange={v => setItem(i, v)}
            leftLabel="Not at all" rightLabel="Very much"
            answerLabel={COG_LABELS[cognition.items[i]] ?? ''}
            icon={<IconBrain size={20} className="text-ink" strokeWidth={1.5} />}
          />
        </QBlock>
      ))}
    </>
  )
}

// ── Step 7: Wellbeing (WHO-5) ──────────────────────────────────────────────────

function Step7Wellbeing({ wellbeing, setWellbeing }: { wellbeing: WellbeingResponses; setWellbeing: (w: WellbeingResponses) => void }) {
  function setItem(i: number, v: number) {
    setWellbeing({ items: wellbeing.items.map((x, j) => j === i ? v : x) })
  }
  return (
    <>
      <StepHeader
        category="Wellbeing · WHO-5"
        title="How have you been feeling overall, over the past couple of weeks?"
        sub="Over the last two weeks, how often did each of the following apply? 0 = At no time, 5 = All of the time."
      />
      {WHO5_ITEMS.map((q, i) => (
        <QBlock key={i} question={q}>
          <Slider
            min={0} max={5} value={wellbeing.items[i]}
            onChange={v => setItem(i, v)}
            leftLabel="At no time" rightLabel="All of the time"
            answerLabel={WHO5_LABELS[wellbeing.items[i]] ?? ''}
            icon={<IconSparkles size={20} className="text-ink" strokeWidth={1.5} />}
          />
        </QBlock>
      ))}
    </>
  )
}

// ── Step 8: Symptoms ──────────────────────────────────────────────────────────

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
        title="Any symptoms you've been noticing recently?"
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
    </>
  )
}

// ── Questionnaire shell ───────────────────────────────────────────────────────

const TOTAL = 8

export default function QuestionnairePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)

  const [history,   setHistory]   = useState<HistoryResponses>({
    age: null, sex: '', ethnicity: 'south_asian', dietaryPreferences: [], unit: 'metric',
    heightCm: '', weightKg: '', heightFt: '', heightIn: '', weightLbs: '', waistCm: '',
    bpSystolic: null, bpDiastolic: null,
    conditions: ['None'], conditionsOther: '',
    medications: 'None', medicationsText: '',
    allergies: 'None known', allergiesText: '',
    tobacco: 'Never', mentalHealth: 'No',
    familyHistory: ['None known'], familyHistoryOther: '',
  })
  const [stress,    setStress]    = useState<StressResponses>({ items: Array(10).fill(0) })
  const [activity,  setActivity]  = useState<ActivityResponses>({ mvpaDays: 3, mvpaMinutes: 30, strengthDays: 2, sittingHours: 6 })
  const [sleep,     setSleep]     = useState<SleepResponses>({ items: Array(8).fill(1) })
  const [nutrition, setNutrition] = useState<NutritionResponses>({ stc: Array(8).fill(0), auditC: Array(3).fill(0) })
  const [cognition, setCognition] = useState<CognitionResponses>({ items: Array(4).fill(3) })
  const [wellbeing, setWellbeing] = useState<WellbeingResponses>({ items: Array(5).fill(3) })
  const [symptoms,  setSymptoms]  = useState<SymptomsResponses>({ physical: [], energyMood: [], otherSymptoms: '' })

  function handleFinish() {
    const answers: QuestionnaireResponses = { history, stress, activity, sleep, nutrition, cognition, wellbeing, symptoms }
    saveQuestionnaire(answers)
    // Hard reload so module-level derived values (findings, report, plan) re-initialise
    // with the newly saved questionnaire data before the user proceeds.
    window.location.href = '/diet-assessment'
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      <BrandHeader stepLabel={`Step ${step} of ${TOTAL}`} />
      <ProgressBar value={Math.round((step / TOTAL) * 100)} className="mx-6 mt-1.5" />

      <div className="px-6 pt-5">
        {step === 1 && <Step1History  history={history}     setHistory={setHistory}     />}
        {step === 2 && <Step2Stress   stress={stress}       setStress={setStress}       />}
        {step === 3 && <Step3Activity activity={activity}   setActivity={setActivity}   />}
        {step === 4 && <Step4Sleep    sleep={sleep}         setSleep={setSleep}         />}
        {step === 5 && <Step5Nutrition nutrition={nutrition} setNutrition={setNutrition} />}
        {step === 6 && <Step6Cognition cognition={cognition} setCognition={setCognition} />}
        {step === 7 && <Step7Wellbeing wellbeing={wellbeing} setWellbeing={setWellbeing} />}
        {step === 8 && <Step8Symptoms symptoms={symptoms}   setSymptoms={setSymptoms}   />}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-bg border-t border-border px-6 py-4 flex gap-3">
        {step > 1 && (
          <Button variant="outline" onClick={() => setStep(s => s - 1)}>
            Back
          </Button>
        )}
        {step === 1 && (
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Exit
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
