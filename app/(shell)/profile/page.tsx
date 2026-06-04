'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrandHeader } from '@/components/ui/BrandHeader'
import { Button } from '@/components/ui/Button'
import { mockData } from '@/lib/data'
import type { GoalId } from '@/lib/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<GoalId, string> = {
  energy:     'More energy',   mood:       'Better mood',
  clarity:    'Mental clarity', sleep:      'Better sleep',
  nutrition:  'Eat well',       fitness:    'Get active',
  prevention: 'Prevention',    wellbeing:  'Overall wellbeing',
}

const DIET_OPTIONS    = ['Omnivore','Vegetarian','Vegan','Pescatarian','Keto','Paleo','Gluten-free','Dairy-free']
const ALLERGY_OPTIONS = ['Nuts','Dairy','Eggs','Gluten','Shellfish','Soy','Wheat','Sesame']
const WORKOUT_TIMES   = ['Morning','Afternoon','Evening','No preference']

type NotifRhythm = 'daily' | 'weekly' | 'off'

// ── Layout helpers ────────────────────────────────────────────────────────────

function SectionCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-5">
      <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-4">{label}</p>
      {children}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-border last:border-0">
      <span className="text-[13px] text-ink-2 w-28 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// ── Read-only display helpers ─────────────────────────────────────────────────

function ReadText({ value }: { value: string }) {
  return <span className="text-[13px] text-ink">{value || '—'}</span>
}

function ReadPills({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-[13px] text-ink-2">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => (
        <span key={item} className="px-2.5 py-1 rounded-full bg-accent text-ink text-[12px] font-medium">
          {item}
        </span>
      ))}
    </div>
  )
}

// ── Edit-mode input helpers ───────────────────────────────────────────────────

function InlineInput({
  value, onChange, placeholder, type = 'text', suffix,
}: {
  value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; suffix?: string
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <input
        type={type}
        inputMode={type === 'number' ? 'decimal' : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '—'}
        className="flex-1 text-[13px] text-ink bg-transparent border-b border-border focus:border-ink outline-none pb-0.5 placeholder:text-ink-2 transition-colors"
      />
      {suffix && <span className="text-[11px] text-ink-2 shrink-0">{suffix}</span>}
    </div>
  )
}

function PillGroup({
  options, selected, onChange,
}: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const on = selected.includes(opt)
        return (
          <button
            key={opt}
            onClick={() => onChange(on ? selected.filter(s => s !== opt) : [...selected, opt])}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors
              ${on ? 'bg-ink text-card' : 'bg-bg-soft border border-border text-ink-2 hover:border-ink-2'}`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function SegmentedControl({
  value, onChange, options,
}: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-full bg-border p-[3px] gap-[3px]">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 rounded-full text-[12px] font-medium transition-all
            ${value === opt.value ? 'bg-card text-ink shadow-card' : 'text-ink-2 hover:text-ink'}`}
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
  const grade    = overall >= 75 ? 'Great' : overall >= 50 ? 'Good' : overall >= 30 ? 'Fair' : 'Needs attention'

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // ── Editable state ──────────────────────────────────────────────────────────
  const [isEditing,     setIsEditing]     = useState(true)
  const [sex,           setSex]           = useState('')
  const [height,        setHeight]        = useState('')
  const [weight,        setWeight]        = useState('')
  const [diet,          setDiet]          = useState<string[]>([])
  const [allergies,     setAllergies]     = useState<string[]>([])
  const [allergyOther,  setAllergyOther]  = useState('')
  const [medications,   setMedications]   = useState('')
  const [workoutTime,   setWorkoutTime]   = useState('')
  const [notifications, setNotifications] = useState<NotifRhythm>('daily')

  // Allergy helpers
  const allergyNoneOn   = allergies.includes('None')
  const allergyOthersOn = allergies.includes('Others')

  function toggleAllergy(opt: string) {
    if (opt === 'None') {
      setAllergies(allergyNoneOn ? [] : ['None'])
      if (!allergyNoneOn) setAllergyOther('')
      return
    }
    if (opt === 'Others') {
      if (allergyNoneOn) return
      if (allergyOthersOn) { setAllergies(allergies.filter(s => s !== 'Others')); setAllergyOther('') }
      else                 { setAllergies([...allergies, 'Others']) }
      return
    }
    // Regular option: deselect None if active
    const base = allergyNoneOn ? [] : allergies
    const on   = base.includes(opt)
    setAllergies(on ? base.filter(s => s !== opt) : [...base.filter(s => s !== 'None'), opt])
  }

  // Computed read-only allergy display list
  const allergyDisplay = allergyNoneOn
    ? ['None']
    : [
        ...allergies.filter(a => a !== 'Others'),
        ...(allergyOthersOn && allergyOther.trim() ? [`Others: ${allergyOther.trim()}`] : []),
      ]

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

        {/* Score — overall only */}
        <SectionCard label="Current score">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[48px] font-medium text-ink leading-none">{overall}</span>
            <span className="text-[15px] text-ink-2">/ 100 · {grade}</span>
          </div>
        </SectionCard>

        {/* ── Physical profile ── */}
        <SectionCard label="Physical profile">
          {isEditing ? (
            <>
              <FieldRow label="Sex">
                <select
                  value={sex}
                  onChange={e => setSex(e.target.value)}
                  className="w-full text-[13px] text-ink bg-transparent border-b border-border focus:border-ink outline-none pb-0.5 appearance-none transition-colors"
                >
                  <option value="" disabled>Select</option>
                  <option>Male</option><option>Female</option>
                  <option>Non-binary</option><option>Prefer not to say</option>
                </select>
              </FieldRow>
              <FieldRow label="Height">
                <InlineInput value={height} onChange={setHeight} placeholder="e.g. 175" type="number" suffix="cm" />
              </FieldRow>
              <FieldRow label="Weight">
                <InlineInput value={weight} onChange={setWeight} placeholder="e.g. 72"  type="number" suffix="kg" />
              </FieldRow>
            </>
          ) : (
            <>
              <FieldRow label="Sex">     <ReadText value={sex}    /> </FieldRow>
              <FieldRow label="Height">  <ReadText value={height ? `${height} cm` : ''} /> </FieldRow>
              <FieldRow label="Weight">  <ReadText value={weight ? `${weight} kg` : ''} /> </FieldRow>
            </>
          )}
        </SectionCard>

        {/* ── Diet & health ── */}
        <SectionCard label="Diet & health">
          {isEditing ? (
            <>
              <FieldRow label="Dietary preferences">
                <PillGroup options={DIET_OPTIONS} selected={diet} onChange={setDiet} />
              </FieldRow>

              <FieldRow label="Allergies & intolerances">
                <div className="flex flex-wrap gap-2">
                  {/* None */}
                  <button
                    onClick={() => toggleAllergy('None')}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors
                      ${allergyNoneOn ? 'bg-ink text-card' : 'bg-bg-soft border border-border text-ink-2 hover:border-ink-2'}`}
                  >
                    None
                  </button>

                  {/* Standard options */}
                  {ALLERGY_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => toggleAllergy(opt)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors
                        ${allergies.includes(opt) && !allergyNoneOn
                          ? 'bg-ink text-card'
                          : 'bg-bg-soft border border-border text-ink-2 hover:border-ink-2'}`}
                    >
                      {opt}
                    </button>
                  ))}

                  {/* Others */}
                  <button
                    onClick={() => toggleAllergy('Others')}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors
                      ${allergyOthersOn && !allergyNoneOn
                        ? 'bg-ink text-card'
                        : 'bg-bg-soft border border-border text-ink-2 hover:border-ink-2'}`}
                  >
                    Others
                  </button>
                </div>

                {/* Free-text for Others */}
                {allergyOthersOn && !allergyNoneOn && (
                  <input
                    type="text"
                    value={allergyOther}
                    onChange={e => setAllergyOther(e.target.value)}
                    placeholder="Describe your allergy or intolerance…"
                    className="mt-3 w-full text-[13px] text-ink bg-transparent border-b border-border focus:border-ink outline-none pb-0.5 placeholder:text-ink-2 transition-colors"
                  />
                )}
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
            </>
          ) : (
            <>
              <FieldRow label="Dietary preferences">    <ReadPills items={diet}            /> </FieldRow>
              <FieldRow label="Allergies & intolerances"><ReadPills items={allergyDisplay} /> </FieldRow>
              <FieldRow label="Medications & supplements">
                <ReadText value={medications} />
              </FieldRow>
            </>
          )}
        </SectionCard>

        {/* ── Preferences ── */}
        <SectionCard label="Preferences">
          {isEditing ? (
            <>
              <FieldRow label="Workout time">
                <div className="flex flex-wrap gap-2">
                  {WORKOUT_TIMES.map(t => (
                    <button
                      key={t}
                      onClick={() => setWorkoutTime(t === workoutTime ? '' : t)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors
                        ${workoutTime === t
                          ? 'bg-ink text-card'
                          : 'bg-bg-soft border border-border text-ink-2 hover:border-ink-2'}`}
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
            </>
          ) : (
            <>
              <FieldRow label="Workout time">
                <ReadText value={workoutTime} />
              </FieldRow>
              <FieldRow label="Notifications">
                <ReadText value={notifications.charAt(0).toUpperCase() + notifications.slice(1)} />
              </FieldRow>
            </>
          )}
        </SectionCard>

        {/* Save / Edit toggle */}
        {isEditing ? (
          <button
            onClick={() => setIsEditing(false)}
            className="w-full py-3 rounded-full bg-ink text-card text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            Save preferences
          </button>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full py-3 rounded-full border border-border text-ink text-[13px] font-medium hover:bg-bg-soft transition-colors"
          >
            Edit preferences
          </button>
        )}

        {/* Goals */}
        <SectionCard label="Your goals">
          <div className="flex flex-wrap gap-2">
            {user.goals.map(g => (
              <span key={g} className="px-3 py-1.5 rounded-full bg-accent text-ink text-[12px] font-medium">
                {GOAL_LABELS[g]}
              </span>
            ))}
          </div>
        </SectionCard>

        {/* Reassessment */}
        <SectionCard label="Next reassessment">
          <p className="font-serif text-[18px] font-medium text-ink mb-1">{fmtDate(user.reassessmentDate)}</p>
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
