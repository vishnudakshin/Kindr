'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PreviousForests } from './PreviousForests'
import type { AssessmentCycle } from '@/lib/types'

// ── Layout constants ──────────────────────────────────────────────────────────

const COLS      = 10
const ROWS      = 9
const CELL      = 24   // px per cell (flat grid)
const GROVE_H   = 240  // visible container height

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

// ── Tree SVGs — sized to stand nicely in a CELL-px plot ───────────────────────
// Trees grow taller across stages; the top protrudes above the cell boundary
// which, after the isometric transform, reads as the tree "standing" on the plot.

function TreeSvg({ stage }: { stage: 1 | 2 | 3 | 4 }) {
  if (stage === 1) return (                          // tiny sapling
    <svg viewBox="0 0 14 22" width={12} height={20} fill="none">
      <rect x="5.5" y="14" width="3" height="7"  rx="1.5" fill="#7A4820"/>
      <circle cx="7" cy="11" r="5.5" fill="#4E8A1A"/>
      <circle cx="4" cy="13" r="3"   fill="#3E7014"/>
      <circle cx="10" cy="13" r="3"  fill="#3E7014"/>
      <circle cx="7" cy="8"  r="4"   fill="#68A828"/>
      <circle cx="7" cy="5"  r="3"   fill="#80C038"/>
    </svg>
  )

  if (stage === 2) return (                          // small tree
    <svg viewBox="0 0 18 28" width={16} height={26} fill="none">
      <rect x="7" y="18" width="4" height="9" rx="2" fill="#6B3A18"/>
      <circle cx="9"  cy="15" r="7"  fill="#427020"/>
      <circle cx="5"  cy="18" r="4"  fill="#325A16"/>
      <circle cx="13" cy="18" r="4"  fill="#325A16"/>
      <circle cx="9"  cy="10" r="6"  fill="#5C9228"/>
      <circle cx="6"  cy="13" r="3.5" fill="#6EAA34"/>
      <circle cx="12" cy="13" r="3.5" fill="#6EAA34"/>
      <circle cx="9"  cy="6"  r="4.5" fill="#80C83E"/>
      <circle cx="7"  cy="4"  r="3"   fill="#94D848" opacity="0.85"/>
      <circle cx="11" cy="4"  r="3"   fill="#94D848" opacity="0.85"/>
    </svg>
  )

  if (stage === 3) return (                          // medium tree
    <svg viewBox="0 0 22 34" width={20} height={32} fill="none">
      <rect x="8.5" y="22" width="5" height="11" rx="2.5" fill="#5A3010"/>
      <circle cx="11" cy="19" r="9"  fill="#386018"/>
      <circle cx="6"  cy="23" r="5.5" fill="#2C500E"/>
      <circle cx="16" cy="23" r="5.5" fill="#2C500E"/>
      <circle cx="11" cy="13" r="8"  fill="#4E8020"/>
      <circle cx="6.5" cy="16" r="5" fill="#5E982A"/>
      <circle cx="15.5" cy="16" r="5" fill="#5E982A"/>
      <circle cx="11" cy="8"  r="6"  fill="#72B030"/>
      <circle cx="7.5" cy="6" r="4"  fill="#88C83A" opacity="0.9"/>
      <circle cx="14.5" cy="6" r="4" fill="#88C83A" opacity="0.9"/>
      <circle cx="11"  cy="3" r="3.5" fill="#A0DC45" opacity="0.8"/>
    </svg>
  )

  // stage 4 — full oak
  return (
    <svg viewBox="0 0 26 38" width={24} height={36} fill="none">
      <rect x="10" y="25" width="6" height="12" rx="3" fill="#4A2808"/>
      <line x1="11" y1="27" x2="4"  y2="21" stroke="#3C2008" strokeWidth="3" strokeLinecap="round"/>
      <line x1="15" y1="27" x2="22" y2="21" stroke="#3C2008" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="2"  cy="20" r="5.5" fill="#224A08"/>
      <circle cx="24" cy="20" r="5.5" fill="#224A08"/>
      <circle cx="13" cy="19" r="10" fill="#306010"/>
      <circle cx="7"  cy="17" r="6.5" fill="#286010"/>
      <circle cx="19" cy="17" r="6.5" fill="#286010"/>
      <circle cx="13" cy="13" r="9"  fill="#427A1C"/>
      <circle cx="8"  cy="11" r="5.5" fill="#52902A"/>
      <circle cx="18" cy="11" r="5.5" fill="#52902A"/>
      <circle cx="13" cy="8"  r="7"  fill="#62A830"/>
      <circle cx="9"  cy="5"  r="4.5" fill="#78BC3C"/>
      <circle cx="17" cy="5"  r="4.5" fill="#78BC3C"/>
      <circle cx="13" cy="3"  r="4"  fill="#90D045"/>
      <circle cx="11" cy="1"  r="2.5" fill="#AADC55" opacity="0.8"/>
      <circle cx="15" cy="1"  r="2.5" fill="#AADC55" opacity="0.8"/>
    </svg>
  )
}

// ── Cell ─────────────────────────────────────────────────────────────────────

interface CellEntry {
  date: string
  isFuture: boolean
  completed: number
  total: number
}

function GroveCell({
  entry,
  selected,
  onSelect,
  index,
}: {
  entry: CellEntry
  selected: boolean
  onSelect: () => void
  index: number
}) {
  const pct = entry.isFuture ? 0 : entry.completed / entry.total
  const stage = entry.isFuture ? -1 :
    pct >= 1.0 ? 4 : pct >= 0.7 ? 3 : pct >= 0.4 ? 2 : pct > 0 ? 1 : 0

  const grass = entry.isFuture ? '#598528' : selected ? '#A8D84A' : '#7EC038'

  return (
    <div
      onClick={entry.isFuture ? undefined : onSelect}
      style={{
        width: CELL,
        height: CELL,
        background: grass,
        border: '0.5px solid rgba(50,80,20,0.55)',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        overflow: 'visible',
        boxSizing: 'border-box',
        cursor: entry.isFuture ? 'default' : 'pointer',
      }}
    >
      {/* Soil oval — visible for all past/present days */}
      {!entry.isFuture && (
        <div
          style={{
            position: 'absolute',
            bottom: '14%',
            left: '50%',
            width: CELL * 0.68,
            height: CELL * 0.34,
            transform: 'translateX(-50%)',
            borderRadius: '50%',
            background: stage > 0 ? '#9E6428' : '#B87838',
            opacity: stage > 0 ? 0.4 : 0.82,
            zIndex: 0,
          }}
        />
      )}

      {/* Future placeholder */}
      {entry.isFuture && (
        <div style={{
          width: 3, height: 3, borderRadius: '50%',
          background: 'rgba(50,80,20,0.35)',
          marginBottom: CELL * 0.35,
        }} />
      )}

      {/* Tree — animates in on mount */}
      {stage > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.2 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.006, type: 'spring', stiffness: 120, damping: 18 }}
          style={{
            position: 'absolute',
            bottom: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
          }}
        >
          <TreeSvg stage={stage as 1 | 2 | 3 | 4} />
        </motion.div>
      )}
    </div>
  )
}

// ── ForestGrove ───────────────────────────────────────────────────────────────

interface Props {
  currentCycle: AssessmentCycle
  previousCycles: AssessmentCycle[]
  today: string
}

export function ForestGrove({ currentCycle, previousCycles, today }: Props) {
  const [selectedEntry, setSelectedEntry] = useState<CellEntry | null>(null)
  const [showPrev, setShowPrev]           = useState(false)

  const { startDate, endDate, days } = currentCycle

  const entries: CellEntry[] = Array.from({ length: COLS * ROWS }, (_, i) => {
    const date  = addDays(startDate, i)
    const entry = days.find(e => e.date === date)
    const isFuture = date > today
    return {
      date,
      isFuture,
      completed: isFuture ? 0 : (entry?.tasksCompleted ?? 0),
      total:     entry?.tasksTotal ?? 10,
    }
  })

  const cycleComplete = !!endDate && today >= endDate
  const daysTended    = entries.filter(e => !e.isFuture && e.completed > 0).length
  const fullDays      = entries.filter(e => !e.isFuture && e.completed >= e.total).length

  function handleSelect(entry: CellEntry) {
    setSelectedEntry(prev => prev?.date === entry.date ? null : entry)
  }

  return (
    <div className="bg-bg-soft rounded-2xl border border-border p-5">
      <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1">Your grove</p>
      <p className="text-[13px] text-ink-2 mb-4 leading-relaxed">
        A grove of 90 days. Each tree, a day you tended to yourself.
      </p>

      {/* ── Isometric grove viewport ── */}
      <div
        style={{
          background: '#1A3316',
          borderRadius: 12,
          height: GROVE_H,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        }}
        onClick={() => setSelectedEntry(null)}
      >
        {/* Isometric CSS grid — rotateX tilts flat; rotateZ gives the diagonal angle */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
            width:  COLS * CELL,
            height: ROWS * CELL,
            transform: 'rotateX(52deg) rotateZ(-42deg)',
            transformOrigin: 'center center',
            outline: '0.5px solid rgba(50,80,20,0.5)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {entries.map((entry, i) => (
            <GroveCell
              key={entry.date}
              entry={entry}
              selected={selectedEntry?.date === entry.date}
              onSelect={() => handleSelect(entry)}
              index={i}
            />
          ))}
        </div>
      </div>

      {/* Selected-day info bar */}
      {selectedEntry && !selectedEntry.isFuture && (
        <div className="bg-card rounded-xl border border-border px-4 py-3 mb-3 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-ink">{fmtDate(selectedEntry.date)}</p>
            <p className="text-[11px] text-ink-2 mt-0.5">
              {selectedEntry.completed} / {selectedEntry.total} tasks completed
            </p>
          </div>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{
              background:
                selectedEntry.completed >= selectedEntry.total ? '#5A7A50' :
                selectedEntry.completed > 0                    ? '#B8842A' : '#C8C0A0',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>
              {Math.round((selectedEntry.completed / selectedEntry.total) * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-6 border-t border-border pt-4">
        <div>
          <p className="text-[10px] text-ink-2 mb-0.5">Days tended</p>
          <p className="font-serif text-[20px] font-medium text-ink leading-none">{daysTended}</p>
        </div>
        <div>
          <p className="text-[10px] text-ink-2 mb-0.5">Full days</p>
          <p className="font-serif text-[20px] font-medium text-ink leading-none">{fullDays}</p>
        </div>
        <div>
          <p className="text-[10px] text-ink-2 mb-0.5">Chapter</p>
          <p className="font-serif text-[20px] font-medium text-ink leading-none">
            {previousCycles.length + 1}
          </p>
        </div>
      </div>

      {/* Reassessment banner */}
      {cycleComplete && (
        <div className="mt-4 rounded-xl bg-accent border border-border p-4">
          <p className="text-[13px] font-medium text-ink mb-1">Your 90-day chapter is complete.</p>
          <p className="text-[12px] text-ink-2 mb-3 leading-relaxed">
            Retake the questionnaire to see how your wellness has shifted and begin your next grove.
          </p>
          <a
            href="/questionnaire"
            className="inline-flex items-center justify-center w-full bg-ink text-[#F5F0D0] font-medium text-[13px] rounded-full py-2.5 hover:opacity-90 transition-opacity"
          >
            Begin a new chapter
          </a>
        </div>
      )}

      {/* Previous chapters */}
      {previousCycles.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowPrev(v => !v)}
            className="text-[12px] text-ink-2 underline underline-offset-2 hover:text-ink transition-colors"
          >
            {showPrev ? 'Hide' : 'View'} previous chapters
          </button>
          {showPrev && (
            <div className="mt-3">
              <PreviousForests cycles={previousCycles} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
