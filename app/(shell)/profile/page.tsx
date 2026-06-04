'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrandHeader } from '@/components/ui/BrandHeader'
import { Button } from '@/components/ui/Button'
import { mockData } from '@/lib/data'
import type { GoalId } from '@/lib/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<GoalId, string> = {
  energy:     'More energy',
  mood:       'Better mood',
  clarity:    'Mental clarity',
  sleep:      'Better sleep',
  nutrition:  'Eat well',
  fitness:    'Get active',
  prevention: 'Prevention',
  wellbeing:  'Overall wellbeing',
}

const DIET_OPTIONS = [
  'Omnivore', 'Vegetarian', 'Vegan', 'Pescatarian',
  'Keto', 'Paleo', 'Gluten-free', 'Dairy-free',
]

const ALLERGY_OPTIONS = [
  'Nuts', 'Dairy', 'Eggs', 'Gluten',
  'Shellfish', 'Soy', 'Wheat', 'Sesame',
]

const WORKOUT_TIMES = ['Morning', 'Afternoon', 'Evening', 'No preference']

type NotifRhythm = 'daily' | 'weekly' | 'off'

// ── Small UI helpers ──────────────────────────────────────────────────────────

function SectionCard({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-5">
      <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-4">{label}</p>
      {children}
    </div>
  )
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-border last:border-0">
      <span className="text-[13px] text-ink-2 w-28 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function InlineInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  suffix,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  suffix?: string
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '—'}
        className="flex-1 text-[13px] text-ink bg-transparent border-b border-border focus:border-ink outline-none pb-0.5 placeholder:text-ink-2 transition-colors"
        inputMode={type === 'number' ? 'decimal' : undefined}
      />
      {suffix && <span className="text-[11px] text-ink-2 shrink-0">{suffix}</span>}
    </div>
  )
}

function PillGroup({
  options,
  selected,
  onChange,
}: {
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const on = selected.includes(opt)
        return (
          <button
            key={opt}
            onClick={() =>
              onChange(on ? selected.filter(s => s !== opt) : [...selected, opt])
            }
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors
              ${on
                ? 'bg-ink text-card'
                : 'bg-bg-soft border border-border text-ink-2 hover:border-ink-2'
              }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-full bg-border p-[3px] gap-[3px]">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 rounded-full text-[12px] font-medium transition-all
            ${value === opt.value
              ? 'bg-card text-ink shadow-card'
              : 'text-ink-2 hover:text-ink'
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter()
  const { user, currentScores } = mockData

  const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase()
  const overall  = currentScores.overall
  const grade    =
    overall >= 75 ? 'Great'  :
    overall >= 50 ? 'Good'   :
    overall >= 30 ? 'Fair'   : 'Needs attention'

  // ── Editable profile state ──────────────────────────────────────────────────
  const [sex,           setSex]           = useState('')
  const [height,        setHeight]        = useState('')
  const [weight,        setWeight]        = useState('')
  const [diet,          setDiet]          = useState<string[]>([])
  const [allergies,     setAllergies]     = useState<string[]>([])
  const [medications,   setMedications]   = useState('')
  const [workoutTime,   setWorkoutTime]   = useState('')
  const [notifications, setNotifications] = useState<NotifRhythm>('daily')

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  return (
    <>
      <BrandHeader />
      <div className="px-6 pt-4 pb-10 flex flex-col gap-5">

        {/* Avatar + name */}
        <div className="flex items-center gap-4 pt-2">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center shrink-0">
            <span className="font-serif text-[22px] font-medium text-ink">{initials}</span>
          </div>
          <div>
            <h1 className="font-serif text-[26px] font-medium text-ink leading-tight">{user.name}</h1>
            <p className="text-[12px] text-ink-2 mt-0.5">Member since {fmtDate(user.dateJoined)}</p>
          </div>
        </div>

        {/* Overall score — collapsed: number + grade only */}
        <SectionCard label="Current score">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[48px] font-medium text-ink leading-none">{overall}</span>
            <span className="text-[15px] text-ink-2">/ 100 · {grade}</span>
          </div>
        </SectionCard>

        {/* Physical profile */}
        <SectionCard label="Physical profile">
          <FieldRow label="Sex">
            <select
              value={sex}
              onChange={e => setSex(e.target.value)}
              className="w-full text-[13px] text-ink bg-transparent border-b border-border focus:border-ink outline-none pb-0.5 appearance-none transition-colors"
            >
              <option value="" disabled>Select</option>
              <option>Male</option>
              <option>Female</option>
              <option>Non-binary</option>
              <option>Prefer not to say</option>
            </select>
          </FieldRow>
          <FieldRow label="Height">
            <InlineInput value={height} onChange={setHeight} placeholder="e.g. 175" type="number" suffix="cm" />
          </FieldRow>
          <FieldRow label="Weight">
            <InlineInput value={weight} onChange={setWeight} placeholder="e.g. 72" type="number" suffix="kg" />
          </FieldRow>
        </SectionCard>

        {/* Diet & health */}
        <SectionCard label="Diet & health">
          <FieldRow label="Dietary preferences">
            <PillGroup options={DIET_OPTIONS} selected={diet} onChange={setDiet} />
          </FieldRow>
          <FieldRow label="Allergies & intolerances">
            <PillGroup options={ALLERGY_OPTIONS} selected={allergies} onChange={setAllergies} />
          </FieldRow>
          <FieldRow label="Medications & supplements">
            <textarea
              value={medications}
              onChange={e => setMedications(e.target.value)}
              placeholder="e.g. Vitamin D, Omega-3, Metformin…"
              rows={2}
              className="w-full text-[13px] text-ink bg-transparent border-b border-border focus:border-ink outline-none pb-0.5 placeholder:text-ink-2 resize-none transition-colors leading-relaxed"
            />
          </FieldRow>
        </SectionCard>

        {/* Preferences */}
        <SectionCard label="Preferences">
          <FieldRow label="Workout time">
            <div className="flex flex-wrap gap-2">
              {WORKOUT_TIMES.map(t => (
                <button
                  key={t}
                  onClick={() => setWorkoutTime(t === workoutTime ? '' : t)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors
                    ${workoutTime === t
                      ? 'bg-ink text-card'
                      : 'bg-bg-soft border border-border text-ink-2 hover:border-ink-2'
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </FieldRow>
          <FieldRow label="Notifications">
            <SegmentedControl
              value={notifications}
              onChange={v => setNotifications(v as NotifRhythm)}
              options={[
                { value: 'daily',  label: 'Daily'  },
                { value: 'weekly', label: 'Weekly' },
                { value: 'off',    label: 'Off'    },
              ]}
            />
          </FieldRow>
        </SectionCard>

        {/* Goals */}
        <SectionCard label="Your goals">
          <div className="flex flex-wrap gap-2">
            {user.goals.map(g => (
              <span
                key={g}
                className="px-3 py-1.5 rounded-full bg-accent text-ink text-[12px] font-medium"
              >
                {GOAL_LABELS[g]}
              </span>
            ))}
          </div>
        </SectionCard>

        {/* Reassessment */}
        <SectionCard label="Next reassessment">
          <p className="font-serif text-[18px] font-medium text-ink mb-1">
            {fmtDate(user.reassessmentDate)}
          </p>
          <p className="text-[12px] text-ink-2 leading-relaxed mb-4">
            Retake the questionnaire to track your progress and refresh your plan.
          </p>
          <Button variant="outline" className="w-full" onClick={() => router.push('/questionnaire')}>
            Retake questionnaire now
          </Button>
        </SectionCard>

      </div>
    </>
  )
}
