'use client'

import { useState } from 'react'
import {
  IconLeaf, IconUserPlus, IconChevronRight,
  IconTestPipe, IconClipboardList, IconClock,
  IconEye, IconX, IconFlask, IconUser, IconApple,
} from '@tabler/icons-react'
import { useUserContext, loadUserData } from '@/lib/UserContext'
import { setActiveUserId } from '@/lib/storage'
import { makeNewUserData } from '@/lib/data'
import type { UserRecord } from '@/lib/storage'
import type { AppData } from '@/lib/types'

// ── Score grade helper ─────────────────────────────────────────────────────────

function grade(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Great',    color: '#2E7D32' }
  if (score >= 50) return { label: 'Good',     color: '#C77D2E' }
  if (score >= 30) return { label: 'Fair',     color: '#B8842A' }
  if (score >  0)  return { label: 'Assessed', color: '#6B6650' }
  return              { label: 'Not yet assessed', color: '#9E9E9E' }
}

// ── Detail sheet ──────────────────────────────────────────────────────────────

type DetailTab = 'questionnaire' | 'diet' | 'labs'

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
      <span className="text-[12px] text-ink-2 shrink-0">{label}</span>
      <span className="text-[12px] text-ink text-right">{String(value)}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] tracking-[.08em] uppercase text-ink-2 mb-2">{title}</p>
      <div className="bg-card rounded-xl border border-border px-4">{children}</div>
    </div>
  )
}

function QuestionnaireTab({ data }: { data: AppData }) {
  const h = data.questionnaire.history
  const s = data.currentScores

  const bmi = h.heightCm && h.weightKg
    ? (parseFloat(h.weightKg) / Math.pow(parseFloat(h.heightCm) / 100, 2)).toFixed(1)
    : null

  return (
    <div className="px-5 pb-6">
      <Section title="Personal">
        <DetailRow label="Age"            value={h.age ? `${h.age} years` : null} />
        <DetailRow label="Sex"            value={h.sex} />
        <DetailRow label="Height"         value={h.heightCm ? `${h.heightCm} cm` : null} />
        <DetailRow label="Weight"         value={h.weightKg ? `${h.weightKg} kg` : null} />
        <DetailRow label="BMI"            value={bmi ? `${bmi}` : null} />
        <DetailRow label="Waist"          value={h.waistCm ? `${h.waistCm} cm` : null} />
        <DetailRow label="Ethnicity"      value={h.ethnicity} />
      </Section>

      {(h.conditions?.length > 0 || h.conditionsOther) && (
        <Section title="Medical conditions">
          {h.conditions?.map((c: string) => (
            <DetailRow key={c} label="" value={c} />
          ))}
          {h.conditionsOther && <DetailRow label="Other" value={h.conditionsOther} />}
        </Section>
      )}

      {h.dietaryPreferences?.length > 0 && (
        <Section title="Dietary preferences">
          {h.dietaryPreferences.map(p => (
            <DetailRow key={p} label="" value={p} />
          ))}
        </Section>
      )}

      {s.overall > 0 && (
        <Section title="Wellness scores">
          {(['overall', 'nutrition', 'stress', 'sleep', 'activity', 'cognition'] as const).map(k => {
            const v = s[k]
            if (!v) return null
            const g = grade(v)
            return (
              <div key={k} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-[12px] text-ink-2 capitalize">{k}</span>
                <span className="text-[12px] font-medium" style={{ color: g.color }}>{v} · {g.label}</span>
              </div>
            )
          })}
        </Section>
      )}

      {h.bpSystolic && h.bpDiastolic && (
        <Section title="Vitals">
          <DetailRow label="Blood pressure" value={`${h.bpSystolic}/${h.bpDiastolic} mmHg`} />
        </Section>
      )}
    </div>
  )
}

function DietTab({ data }: { data: AppData }) {
  const da = data.dietAssessment
  if (!da) {
    return (
      <div className="px-5 pb-6 pt-2 flex flex-col items-center text-center gap-3 mt-8">
        <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
          <IconApple size={20} strokeWidth={1.5} className="text-ink" />
        </div>
        <p className="text-[13px] text-ink-2">No diet assessment recorded yet.</p>
      </div>
    )
  }

  const goalLabel: Record<string, string> = {
    lose_weight:  'Lose weight',
    maintain:     'Maintain',
    gain_weight:  'Gain weight',
    gain_muscle:  'Build muscle',
  }

  const dietGoal = data.dietaryGoal

  return (
    <div className="px-5 pb-6">
      <Section title="Goals & targets">
        {dietGoal && <DetailRow label="Goal" value={goalLabel[dietGoal] ?? dietGoal} />}
        <DetailRow label="Assessment goal" value={goalLabel[da.goal] ?? da.goal} />
        <DetailRow label="TDEE"            value={da.tdee ? `${da.tdee} kcal/day` : null} />
        <DetailRow label="BMR"             value={da.bmr  ? `${da.bmr} kcal/day`  : null} />
        <DetailRow label="Protein target"  value={da.proteinTarget ? `${da.proteinTarget} g/kg` : null} />
        <DetailRow label="Activity level"  value={da.activityLevel} />
        <DetailRow label="Meals/day"       value={da.mealCount} />
      </Section>

      {da.macros && (
        <Section title="Daily macro targets">
          <DetailRow label="Protein" value={`${da.macros.protein_g} g`} />
          <DetailRow label="Fat"     value={`${da.macros.fat_g} g`} />
          <DetailRow label="Carbs"   value={`${da.macros.carbs_g} g`} />
        </Section>
      )}
    </div>
  )
}

function LabsTab({ data }: { data: AppData }) {
  const bp = data.bloodPanel
  const groups = Object.entries(bp).filter(([, tests]) =>
    Object.values(tests).some(r => r.value !== '')
  )

  if (groups.length === 0) {
    return (
      <div className="px-5 pb-6 pt-2 flex flex-col items-center text-center gap-3 mt-8">
        <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
          <IconFlask size={20} strokeWidth={1.5} className="text-ink" />
        </div>
        <p className="text-[13px] text-ink-2">No lab results recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="px-5 pb-6">
      {groups.map(([group, tests]) => (
        <Section key={group} title={group}>
          {Object.entries(tests)
            .filter(([, r]) => r.value !== '')
            .map(([name, r]) => (
              <div key={name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-ink">{name}</p>
                  <p className="text-[10px] text-ink-2">ref {r.refRange}</p>
                </div>
                <p className="text-[12px] font-medium text-ink ml-3 shrink-0">
                  {r.value} <span className="text-ink-2 font-normal">{r.unit}</span>
                </p>
              </div>
            ))}
        </Section>
      ))}
    </div>
  )
}

function PatientDetailSheet({
  record,
  data,
  onClose,
}: {
  record: UserRecord
  data: AppData
  onClose: () => void
}) {
  const [tab, setTab] = useState<DetailTab>('questionnaire')
  const initials = record.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const tabs: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
    { id: 'questionnaire', label: 'Assessment', icon: <IconClipboardList size={13} strokeWidth={1.5} /> },
    { id: 'diet',          label: 'Diet',       icon: <IconApple size={13} strokeWidth={1.5} /> },
    { id: 'labs',          label: 'Labs',       icon: <IconFlask size={13} strokeWidth={1.5} /> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-h-[90vh] bg-bg rounded-t-3xl flex flex-col overflow-hidden">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-2 pb-4 shrink-0">
          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
            <span className="font-serif text-[14px] font-medium text-ink">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-serif text-[18px] font-medium text-ink leading-tight">{record.name}</p>
            <p className="text-[11px] text-ink-2">Patient record</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-soft transition-colors"
          >
            <IconX size={16} strokeWidth={1.5} className="text-ink-2" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 mb-3 shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                tab === t.id
                  ? 'bg-ink text-card'
                  : 'bg-card border border-border text-ink-2 hover:text-ink'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1">
          {tab === 'questionnaire' && <QuestionnaireTab data={data} />}
          {tab === 'diet'          && <DietTab data={data} />}
          {tab === 'labs'          && <LabsTab data={data} />}
        </div>
      </div>
    </div>
  )
}

// ── Patient card ──────────────────────────────────────────────────────────────

function PatientCard({
  record,
  onSelect,
  onViewDetail,
}: {
  record: UserRecord
  onSelect: () => void
  onViewDetail: () => void
}) {
  const g        = grade(record.overallScore)
  const initials = record.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-5 flex items-start gap-4">
      {/* Avatar */}
      <button onClick={onSelect} className="w-12 h-12 rounded-full bg-accent flex items-center justify-center shrink-0">
        <span className="font-serif text-[16px] font-medium text-ink">{initials}</span>
      </button>

      {/* Info — clicking the info area switches to the user */}
      <button onClick={onSelect} className="flex-1 min-w-0 text-left">
        <p className="font-serif text-[17px] font-medium text-ink leading-snug">{record.name}</p>

        {/* Score */}
        <div className="flex items-center gap-1.5 mt-1">
          {record.overallScore > 0 && (
            <span className="text-[13px] font-medium text-ink">{record.overallScore}</span>
          )}
          <span className="text-[12px]" style={{ color: g.color }}>{g.label}</span>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-3 mt-2">
          <span className="flex items-center gap-1 text-[11px] text-ink-2">
            <IconClipboardList size={11} strokeWidth={1.5} />
            {record.hasQuestionnaire ? 'Assessment done' : 'Needs assessment'}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-ink-2">
            <IconTestPipe size={11} strokeWidth={1.5} />
            {record.hasLabResults ? 'Labs entered' : 'No labs yet'}
          </span>
        </div>

        {/* Updated */}
        <p className="flex items-center gap-1 text-[10px] text-ink-2 mt-1.5">
          <IconClock size={10} strokeWidth={1.5} />
          Updated {record.lastUpdated}
        </p>
      </button>

      {/* Actions */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <button
          onClick={onViewDetail}
          title="View patient record"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-soft border border-border hover:bg-accent transition-colors"
        >
          <IconEye size={14} strokeWidth={1.5} className="text-ink-2" />
        </button>
        <button onClick={onSelect} className="w-8 h-8 flex items-center justify-center">
          <IconChevronRight size={16} strokeWidth={1.5} className="text-ink-2" />
        </button>
      </div>
    </div>
  )
}

// ── Add patient modal ─────────────────────────────────────────────────────────

function AddPatientModal({ onClose }: { onClose: () => void }) {
  const { createUser } = useUserContext()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    const initialData = makeNewUserData(trimmed)
    const id = createUser(trimmed, initialData)
    setActiveUserId(id)
    // Hard reload so module re-initialises with the new blank patient's data.
    window.location.href = '/questionnaire'
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border shadow-card w-full max-w-md p-6">
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1">New patient</p>
        <h2 className="font-serif text-[22px] font-medium text-ink mb-5">Enter patient name</h2>

        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Full name"
          autoFocus
          className="w-full px-4 py-3 rounded-xl border border-border bg-bg text-[14px] text-ink placeholder-ink-2 focus:outline-none focus:border-ink-2 mb-4"
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full border border-border text-ink text-[13px] font-medium hover:bg-bg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!name.trim() || busy}
            className="flex-1 py-3 rounded-full bg-ink text-card text-[13px] font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {busy ? 'Creating…' : 'Create & start assessment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const { users, switchUser } = useUserContext()
  const [showAdd, setShowAdd] = useState(false)
  const [detail, setDetail] = useState<{ record: UserRecord; data: AppData } | null>(null)

  function openDetail(record: UserRecord) {
    const data = loadUserData(record.id)
    if (data) setDetail({ record, data })
  }

  return (
    <main className="min-h-screen bg-bg">
      {/* Header */}
      <header className="px-6 pt-8 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="font-serif text-[26px] font-medium text-ink leading-none">Kindr.</span>
            <IconLeaf size={14} className="text-ink-2" />
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-ink text-card px-4 py-2 rounded-full text-[12px] font-medium hover:opacity-90 transition-opacity"
          >
            <IconUserPlus size={14} strokeWidth={2} />
            Add patient
          </button>
        </div>
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mt-4 mb-1">Patients</p>
        <h1 className="font-serif text-[28px] font-medium text-ink leading-snug">
          {users.length === 0 ? 'No patients yet.' : `${users.length} patient${users.length > 1 ? 's' : ''}`}
        </h1>
      </header>

      {/* List */}
      <section className="px-6 pb-12">
        {users.length === 0 ? (
          <div className="mt-12 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
              <IconUserPlus size={24} strokeWidth={1.5} className="text-ink" />
            </div>
            <p className="text-[15px] text-ink-2 leading-relaxed max-w-xs">
              Add your first patient to get started. Their health assessment, lab data and wellness plan will all live here.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-2 px-6 py-3 bg-accent text-ink rounded-full text-[13px] font-medium hover:bg-[#ddd690] transition-colors"
            >
              Add first patient
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-2">
            {users.map(record => (
              <PatientCard
                key={record.id}
                record={record}
                onSelect={() => switchUser(record.id)}
                onViewDetail={() => openDetail(record)}
              />
            ))}
          </div>
        )}
      </section>

      {showAdd && <AddPatientModal onClose={() => setShowAdd(false)} />}

      {detail && (
        <PatientDetailSheet
          record={detail.record}
          data={detail.data}
          onClose={() => setDetail(null)}
        />
      )}
    </main>
  )
}
