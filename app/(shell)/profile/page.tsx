'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrandHeader } from '@/components/ui/BrandHeader'
import { Button } from '@/components/ui/Button'
import { mockData } from '@/lib/data'
import { ShareReportButton } from '@/components/share/ShareReportButton'
import { ACTIVITY_LABEL } from '@/lib/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const WORKOUT_TIMES = ['Morning','Afternoon','Evening','No preference']

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

// ── Nutrition assessment card ─────────────────────────────────────────────────

function NutritionAssessmentCard() {
  const da = mockData.dietAssessment

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-5">
      <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-4">
        Nutrition assessment
      </p>

      {da ? (
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[32px] font-medium text-ink leading-none">
              {da.tdee.toLocaleString()}
            </span>
            <span className="text-[13px] text-ink-2">kcal / day</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Protein', value: `${da.macros.protein_g}g` },
              { label: 'Carbs',   value: `${da.macros.carbs_g}g`   },
              { label: 'Fat',     value: `${da.macros.fat_g}g`     },
            ].map(({ label, value }) => (
              <div key={label} className="bg-bg-soft rounded-xl px-3 py-2.5 text-center">
                <p className="text-[13px] font-medium text-ink">{value}</p>
                <p className="text-[10px] text-ink-2 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-2">
            {ACTIVITY_LABEL[da.activityLevel]} · Goal: {da.goal.replace('_', ' ')} · Last assessed {da.completedDate}
          </p>
        </div>
      ) : (
        <p className="text-[13px] text-ink-2 leading-relaxed mb-4">
          Not yet completed for this cycle. Run a diet assessment to set calorie and macro targets for this patient's plan.
        </p>
      )}

      <button
        onClick={() => { window.location.href = '/diet-assessment' }}
        className="w-full py-3 rounded-full border border-ink text-ink text-[13px] font-medium hover:bg-bg transition-colors"
      >
        {da ? 'Update diet assessment' : 'Start diet assessment'}
      </button>
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

  // ── Pre-populate from questionnaire Step 1 ──────────────────────────────────
  const h = mockData.questionnaire.history

  function initHeight(): string {
    if (h.unit === 'metric') return h.heightCm
    const ft = parseFloat(h.heightFt || '0'), ins = parseFloat(h.heightIn || '0')
    return ft || ins ? String(Math.round((ft * 12 + ins) * 2.54)) : ''
  }
  function initWeight(): string {
    if (h.unit === 'metric') return h.weightKg
    return h.weightLbs ? String(Math.round(parseFloat(h.weightLbs) * 0.453592)) : ''
  }
  // Map questionnaire allergy category → profile pill state
  function initAllergies(): string[] {
    if (!h.allergies || h.allergies === 'None known') return ['None']
    return h.allergiesText ? ['Others'] : []
  }

  // ── State from questionnaire (physical & diet are read-only) ───────────────
  const sex        = h.sex ?? ''
  const height     = initHeight()
  const weight     = initWeight()
  const diet       = h.dietaryPreferences ?? []
  const allergies  = initAllergies()
  const allergyOther = h.allergies && h.allergies !== 'None known' ? (h.allergiesText ?? '') : ''
  const medications  = h.medicationsText ?? ''

  const [workoutTime,   setWorkoutTime]   = useState('')
  const [notifications, setNotifications] = useState<NotifRhythm>('daily')

  // Allergy display helpers
  const allergyNoneOn   = allergies.includes('None')
  const allergyOthersOn = allergies.includes('Others')

  const allergyDisplay = allergyNoneOn
    ? ['None']
    : [
        ...allergies.filter(a => a !== 'Others'),
        ...(allergyOthersOn && allergyOther.trim() ? [`Others: ${allergyOther.trim()}`] : []),
      ]

  return (
    <>
      <BrandHeader href="/" />
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
          <FieldRow label="Sex">     <ReadText value={sex}    /> </FieldRow>
          <FieldRow label="Height">  <ReadText value={height ? `${height} cm` : ''} /> </FieldRow>
          <FieldRow label="Weight">  <ReadText value={weight ? `${weight} kg` : ''} /> </FieldRow>
        </SectionCard>

        {/* ── Diet & health ── */}
        <SectionCard label="Diet & health">
          <FieldRow label="Dietary preferences">    <ReadPills items={diet}            /> </FieldRow>
          <FieldRow label="Allergies & intolerances"><ReadPills items={allergyDisplay} /> </FieldRow>
          <FieldRow label="Medications & supplements">
            <ReadText value={medications} />
          </FieldRow>
        </SectionCard>

        {/* ── Nutrition assessment ── */}
        <NutritionAssessmentCard />

        {/* ── Preferences ── */}
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
        </SectionCard>

        {/* Share report */}
        <ShareReportButton variant="primary" />

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
