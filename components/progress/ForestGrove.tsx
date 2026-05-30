'use client'

import { useState } from 'react'
import { ForestTreeSpot } from './ForestTreeSpot'
import { PreviousForests } from './PreviousForests'
import type { AssessmentCycle } from '@/lib/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

function seededRand(seed: number): number {
  const x = Math.sin(seed + 1.7) * 9301 + 49297
  return x - Math.floor(x)
}

// ── Layout constants ──────────────────────────────────────────────────────────

const COLS    = 10
const ROWS    = 9
const COL_W   = 28   // px per column
const ROW_H   = 34   // px per row
const PAD_H   = 3    // left offset
const PAD_V   = 4    // top offset
const JX      = 5    // max ±jitter on x
const JY      = 3.5  // max ±jitter on y

const GROVE_H = ROWS * ROW_H + PAD_V * 2

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  currentCycle: AssessmentCycle
  previousCycles: AssessmentCycle[]
  today: string
}

export function ForestGrove({ currentCycle, previousCycles, today }: Props) {
  const [activeDate, setActiveDate]   = useState<string | null>(null)
  const [showPrev, setShowPrev]       = useState(false)

  const { startDate, endDate, days } = currentCycle

  // Build 90 day entries
  const entries = Array.from({ length: COLS * ROWS }, (_, i) => {
    const date  = addDays(startDate, i)
    const entry = days.find(e => e.date === date)
    const isFuture = date > today
    if (isFuture) return { date, isFuture: true, completed: 0, total: 10 }
    return {
      date,
      isFuture: false,
      completed: entry?.tasksCompleted ?? 0,
      total:     entry?.tasksTotal     ?? 10,
    }
  })

  const cycleComplete = !!endDate && today >= endDate
  const daysTended    = entries.filter(e => !e.isFuture && e.completed > 0).length
  const fullDays      = entries.filter(e => !e.isFuture && e.completed >= e.total).length

  return (
    <div className="bg-bg-soft rounded-2xl border border-border p-5">
      <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1">Your grove</p>
      <p className="text-[13px] text-ink-2 mb-5 leading-relaxed">
        A grove of 90 days. Each tree, a day you tended to yourself.
      </p>

      {/* Grove */}
      <div
        className="relative"
        style={{ height: GROVE_H }}
        onClick={() => setActiveDate(null)}
      >
        {entries.map((entry, i) => {
          const col  = i % COLS
          const row  = Math.floor(i / COLS)
          const jx   = (seededRand(i * 2 + 1) - 0.5) * JX * 2
          const jy   = (seededRand(i * 2 + 2) - 0.5) * JY * 2
          const left = col * COL_W + PAD_H + jx
          const top  = row * ROW_H + PAD_V + jy

          return (
            <div
              key={entry.date}
              className="absolute"
              style={{ left, top }}
              onClick={e => e.stopPropagation()}
            >
              <ForestTreeSpot
                date={entry.date}
                tasksCompleted={entry.completed}
                tasksTotal={entry.total}
                isFuture={entry.isFuture}
                isActive={activeDate === entry.date}
                onActivate={() => setActiveDate(d => d === entry.date ? null : entry.date)}
                delay={i * 0.012}
              />
            </div>
          )
        })}
      </div>

      {/* Stats row */}
      <div className="mt-3 flex items-center gap-6 border-t border-border pt-4">
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
