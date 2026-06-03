'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PreviousForests } from './PreviousForests'
import type { AssessmentCycle } from '@/lib/types'

// ── Color palette — matches SaplingTree.tsx exactly ───────────────────────────
const TRUNK       = '#A07845'
const TRUNK_LIGHT = '#C49A5A'
const LEAF_DARK   = '#3E7832'
const LEAF_MID    = '#5C9645'
const LEAF_LIGHT  = '#7AB855'
const LEAF_BRIGHT = '#90C060'
const SOIL_SHADOW = '#C8BA82'
const SOIL_MOUND  = '#C0A060'

// ── Geometry ──────────────────────────────────────────────────────────────────
// TW=32 gives sprite bases ~18px apart — enough clearance between tree canopies.
// Coordinates below are derived from SaplingTree's 120×152 viewBox at 0.26× scale,
// translated so ground-level (y=144 in plan space) maps to y=0 here.
// transform: gx = (px − 60) × 0.26,  gy = (py − 144) × 0.26

const COLS = 10
const ROWS = 9
const TW   = 32
const TH   = TW / 2   // 16
const HW   = TW / 2   // 16
const HH   = TH / 2   // 8

const OX = ROWS * HW                                        // 144
const OY = 90                                               // headroom for tallest tree

const SVG_W = (COLS + ROWS) * HW                            // 304
const SVG_H = OY + (COLS + ROWS) * HH + TH + 6             // 264  → ratio 304/264 ≈ 1.15

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

function tileTopVertex(col: number, row: number) {
  return { x: OX + (col - row) * HW, y: OY + (col + row) * HH }
}

function diamondPoints(col: number, row: number): string {
  const { x, y } = tileTopVertex(col, row)
  return `${x},${y} ${x + HW},${y + HH} ${x},${y + TH} ${x - HW},${y + HH}`
}

function spriteBase(col: number, row: number) {
  const { x, y } = tileTopVertex(col, row)
  return { x, y: y + TH * 0.65 }
}

// ── Tree sprites — (0,0) = trunk base / soil centre, y-negative = upward ──────
// Each matches one of the four stages shown in /references/trees/.

/** Stage 1 — Seedling: prominent soil mound + tiny two-leaf sprout (~11 px tall). */
function TreeS1() {
  return (
    <g>
      {/* Soil mound dome */}
      <path
        d="M-4.2,-1 C-4.2,-4.2 -2.3,-6 0,-6 C2.3,-6 4.2,-4.2 4.2,-1 Z"
        fill={SOIL_MOUND}
      />
      <ellipse cy={-1} rx={4.2} ry={1} fill="#B09050" />
      {/* Stem */}
      <line x1={0} y1={-6} x2={0} y2={-9.4}
        stroke="#7A9848" strokeWidth={0.9} strokeLinecap="round" />
      {/* Left seedling leaf */}
      <ellipse cx={-2.1} cy={-9.4} rx={2.3} ry={1.3}
        fill="#82B268" transform="rotate(-28 -2.1 -9.4)" />
      {/* Right seedling leaf */}
      <ellipse cx={2.1}  cy={-9.4} rx={2.3} ry={1.3}
        fill="#82B268" transform="rotate(28 2.1 -9.4)" />
      {/* Upright centre leaf */}
      <ellipse cy={-11} rx={1.2} ry={1.8} fill="#8EC264" />
    </g>
  )
}

/** Stage 2 — Sapling: thin trunk + three broad leaves (palm silhouette, ~17 px tall). */
function TreeS2() {
  return (
    <g>
      {/* Soil bump */}
      <ellipse cy={-0.8} rx={2.3} ry={0.9} fill={SOIL_MOUND} opacity={0.5} />
      {/* Trunk */}
      <rect x={-0.9} y={-12.5} width={1.8} height={12.5} rx={0.9} fill={TRUNK} />
      {/* Left broad leaf */}
      <ellipse cx={-3.6} cy={-13.5} rx={3.9} ry={2.0}
        fill={LEAF_LIGHT} transform="rotate(-22 -3.6 -13.5)" />
      <ellipse cx={-4.4} cy={-14.5} rx={1.6} ry={0.8}
        fill={LEAF_BRIGHT} opacity={0.5} transform="rotate(-22 -4.4 -14.5)" />
      {/* Right broad leaf */}
      <ellipse cx={3.6} cy={-13.5} rx={3.9} ry={2.0}
        fill={LEAF_LIGHT} transform="rotate(22 3.6 -13.5)" />
      <ellipse cx={4.4} cy={-14.5} rx={1.6} ry={0.8}
        fill={LEAF_BRIGHT} opacity={0.5} transform="rotate(22 4.4 -14.5)" />
      {/* Upright centre leaf */}
      <ellipse cy={-16.2} rx={1.8} ry={3.1} fill="#8EC264" />
    </g>
  )
}

/** Stage 3 — Young tree: chunky trunk + compact round cloud canopy (~24 px tall). */
function TreeS3() {
  return (
    <g>
      {/* Ground shadow */}
      <ellipse cy={1.5} rx={5.0} ry={1.8} fill={SOIL_SHADOW} opacity={0.55} />
      {/* Trunk */}
      <rect x={-1.4} y={-12.5} width={2.8} height={12.5} rx={1.0} fill={TRUNK} />
      <line x1={-0.4} y1={-12} x2={-0.4} y2={-1}
        stroke={TRUNK_LIGHT} strokeWidth={0.8} strokeLinecap="round" opacity={0.45} />
      {/* Lower canopy bulges */}
      <circle cx={-4.2} cy={-13.8} r={3.4} fill={LEAF_MID} />
      <circle cx={ 4.2} cy={-13.8} r={3.4} fill={LEAF_MID} />
      {/* Central main dome */}
      <circle cy={-15.6} r={4.9} fill={LEAF_MID} />
      {/* Upper canopy */}
      <circle cy={-19.8} r={3.9} fill={LEAF_LIGHT} />
      {/* Highlights */}
      <circle cx={-2.1} cy={-18.5} r={2.1} fill={LEAF_BRIGHT} opacity={0.52} />
      <circle cx={ 2.1} cy={-19.0} r={1.8} fill={LEAF_BRIGHT} opacity={0.46} />
    </g>
  )
}

/** Stage 4 — Full tree: thick trunk + multi-layer canopy (plan tab stage 3 style, ~29 px tall). */
function TreeS4() {
  return (
    <g>
      {/* Ground shadow */}
      <ellipse cy={1.5} rx={7.0} ry={2.5} fill={SOIL_SHADOW} opacity={0.55} />
      {/* Trunk */}
      <rect x={-2.0} y={-14} width={4.0} height={14} rx={1.4} fill={TRUNK} />
      <line x1={-0.6} y1={-13.5} x2={-0.6} y2={-1}
        stroke={TRUNK_LIGHT} strokeWidth={0.9} strokeLinecap="round" opacity={0.38} />
      {/* Layer 1 — outer dark base */}
      <circle cx={-6.0} cy={-13.0} r={4.9} fill={LEAF_DARK} opacity={0.9} />
      <circle cx={ 6.0} cy={-13.0} r={4.9} fill={LEAF_DARK} opacity={0.9} />
      {/* Layer 2 — mid green main body */}
      <circle cy={-16.6} r={6.5} fill={LEAF_MID} />
      {/* Layer 3 — upper bright */}
      <circle cx={-4.2} cy={-20.8} r={4.4} fill={LEAF_LIGHT} />
      <circle cx={ 4.2} cy={-20.8} r={4.4} fill={LEAF_LIGHT} />
      <circle cy={-23.9} r={4.9} fill={LEAF_LIGHT} />
      {/* Highlights */}
      <circle cx={-2.6} cy={-22.4} r={2.3} fill={LEAF_BRIGHT} opacity={0.52} />
      <circle cx={ 2.6} cy={-22.9} r={2.1} fill={LEAF_BRIGHT} opacity={0.46} />
      <circle cx={-4.7} cy={-16.6} r={1.6} fill={LEAF_BRIGHT} opacity={0.38} />
      <circle cx={ 4.7} cy={-16.6} r={1.6} fill={LEAF_BRIGHT} opacity={0.38} />
    </g>
  )
}

// ── Entry type ────────────────────────────────────────────────────────────────

interface Entry {
  col: number; row: number
  date: string; isFuture: boolean
  completed: number; total: number
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  currentCycle: AssessmentCycle
  previousCycles: AssessmentCycle[]
  today: string
}

export function ForestGrove({ currentCycle, previousCycles, today }: Props) {
  const [selected, setSelected] = useState<Entry | null>(null)
  const [showPrev, setShowPrev] = useState(false)

  const { startDate, endDate, days } = currentCycle

  const entries: Entry[] = Array.from({ length: COLS * ROWS }, (_, i) => {
    const col   = i % COLS
    const row   = Math.floor(i / COLS)
    const date  = addDays(startDate, i)
    const entry = days.find(e => e.date === date)
    const isFuture = date > today
    return {
      col, row, date, isFuture,
      completed: isFuture ? 0 : (entry?.tasksCompleted ?? 0),
      total:     entry?.tasksTotal ?? 10,
    }
  })

  // Painter's algorithm: back-to-front
  const paintOrder = [...entries].sort((a, b) =>
    (a.col + a.row) - (b.col + b.row) || a.col - b.col,
  )

  const cycleComplete = !!endDate && today >= endDate
  const daysTended    = entries.filter(e => !e.isFuture && e.completed > 0).length
  const fullDays      = entries.filter(e => !e.isFuture && e.completed >= e.total).length

  function toggle(entry: Entry) {
    setSelected(prev => prev?.date === entry.date ? null : entry)
  }

  return (
    <div className="bg-bg-soft rounded-2xl border border-border p-5">
      <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1">Your grove</p>
      <p className="text-[13px] text-ink-2 mb-4 leading-relaxed">
        A grove of 90 days. Each tree, a day you tended to yourself.
      </p>

      {/* ── Grove SVG ── */}
      <div style={{ borderRadius: 12, overflow: 'hidden', background: '#182E14', marginBottom: 10 }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          style={{ display: 'block' }}
          onClick={() => setSelected(null)}
        >
          {paintOrder.map(entry => {
            const { col, row } = entry
            const { x: tx, y: ty } = tileTopVertex(col, row)
            const { x: bx, y: by } = spriteBase(col, row)

            const pct   = entry.isFuture ? 0 : entry.completed / entry.total
            const stage = entry.isFuture ? 0 :
              pct >= 1.0 ? 4 : pct >= 0.7 ? 3 : pct >= 0.4 ? 2 : pct > 0 ? 1 : 0

            const isSelected = selected?.date === entry.date
            const grass = entry.isFuture ? '#527A22' : isSelected ? '#A8DC48' : '#78BA38'

            const delay = (col + row) * 0.032 + col * 0.003

            return (
              <g key={entry.date}>
                {/* Ground tile */}
                <polygon
                  points={diamondPoints(col, row)}
                  fill={grass}
                  stroke="rgba(30,60,10,0.45)"
                  strokeWidth={0.5}
                  style={{ cursor: entry.isFuture ? 'default' : 'pointer' }}
                  onClick={entry.isFuture ? undefined : e => { e.stopPropagation(); toggle(entry) }}
                />

                {/* Soil patch for empty past tiles */}
                {!entry.isFuture && stage === 0 && (
                  <ellipse
                    cx={tx} cy={ty + TH * 0.68}
                    rx={TW * 0.22} ry={TH * 0.22}
                    fill="#B06820" opacity={0.72}
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* Tree — springs up from sprite base */}
                {stage > 0 && (
                  <motion.g
                    initial={{ opacity: 0, scale: 0.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ transformOrigin: `${bx}px ${by}px`, pointerEvents: 'none' }}
                    transition={{ delay, type: 'spring', stiffness: 160, damping: 18 }}
                  >
                    <g transform={`translate(${bx} ${by})`}>
                      {stage === 1 && <TreeS1 />}
                      {stage === 2 && <TreeS2 />}
                      {stage === 3 && <TreeS3 />}
                      {stage === 4 && <TreeS4 />}
                    </g>
                  </motion.g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* ── Selected day info ── */}
      {selected && !selected.isFuture && (
        <div className="bg-card rounded-xl border border-border px-4 py-3 mb-3 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-ink">{fmtDate(selected.date)}</p>
            <p className="text-[11px] text-ink-2 mt-0.5">
              {selected.completed} / {selected.total} tasks completed
            </p>
          </div>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{
              background:
                selected.completed >= selected.total ? '#5A7A50' :
                selected.completed > 0               ? '#B8842A' : '#C8C0A0',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>
              {Math.round((selected.completed / selected.total) * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
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

      {/* ── Reassessment banner ── */}
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

      {/* ── Previous chapters ── */}
      {previousCycles.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowPrev(v => !v)}
            className="text-[12px] text-ink-2 underline underline-offset-2 hover:text-ink transition-colors"
          >
            {showPrev ? 'Hide' : 'View'} previous chapters
          </button>
          {showPrev && <div className="mt-3"><PreviousForests cycles={previousCycles} /></div>}
        </div>
      )}
    </div>
  )
}
