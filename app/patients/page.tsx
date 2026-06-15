'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconLeaf, IconUserPlus, IconChevronRight,
  IconTestPipe, IconClipboardList, IconClock,
} from '@tabler/icons-react'
import { useUserContext } from '@/lib/UserContext'
import { setActiveUserId } from '@/lib/storage'
import { makeNewUserData } from '@/lib/data'
import type { UserRecord } from '@/lib/storage'

// ── Score grade helper ─────────────────────────────────────────────────────────

function grade(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Great',    color: '#2E7D32' }
  if (score >= 50) return { label: 'Good',     color: '#C77D2E' }
  if (score >= 30) return { label: 'Fair',     color: '#B8842A' }
  if (score >  0)  return { label: 'Assessed', color: '#6B6650' }
  return              { label: 'Not yet assessed', color: '#9E9E9E' }
}

// ── Patient card ──────────────────────────────────────────────────────────────

function PatientCard({
  record,
  onSelect,
}: {
  record: UserRecord
  onSelect: () => void
}) {
  const g        = grade(record.overallScore)
  const initials = record.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <button
      onClick={onSelect}
      className="w-full bg-card rounded-2xl border border-border shadow-card p-5 flex items-start gap-4 text-left hover:border-ink-2 transition-colors"
    >
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center shrink-0">
        <span className="font-serif text-[16px] font-medium text-ink">{initials}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
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
      </div>

      <IconChevronRight size={16} strokeWidth={1.5} className="text-ink-2 mt-1 shrink-0" />
    </button>
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
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)

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
              />
            ))}
          </div>
        )}
      </section>

      {showAdd && <AddPatientModal onClose={() => setShowAdd(false)} />}
    </main>
  )
}
