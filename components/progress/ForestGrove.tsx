'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PreviousForests } from './PreviousForests'
import type { AssessmentCycle } from '@/lib/types'

// ── Palette — identical to SaplingTree.tsx ────────────────────────────────────
const TRUNK       = '#A07845'
const TRUNK_LIGHT = '#C49A5A'
const LEAF_DARK   = '#3E7832'
const LEAF_MID    = '#5C9645'
const LEAF_LIGHT  = '#7AB855'
const LEAF_BRIGHT = '#90C060'
const SOIL_SHADOW = '#C8BA82'

// ── Geometry ──────────────────────────────────────────────────────────────────
const COLS = 10
const ROWS = 9
const TW   = 32
const TH   = TW / 2          // 16
const HW   = TW / 2          // 16
const HH   = TH / 2          // 8

const OX   = ROWS * HW                               // 144
const OY   = 48                                      // headroom (Tree4 ~30 px at 0.65 scale)

const SVG_W = (COLS + ROWS) * HW                     // 304
const SVG_H = OY + (COLS + ROWS) * HH + TH + 6      // 222  →  304/222 ≈ 1.37

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

// ── Score → stage ─────────────────────────────────────────────────────────────
// Score = tasks completed out of 10 (rounded).
// 0          → empty tile (no tree, no mound)
// 1          → Sapling
// 2–4        → Tree1
// 5–6        → Tree2
// 7–9        → Tree3
// 10         → Tree4

function toStage(completed: number, total: number, isFuture: boolean): number {
  if (isFuture || completed === 0) return 0
  const score = Math.round((completed / Math.max(total, 1)) * 10)
  if (score <= 1) return 1   // sapling
  if (score <= 4) return 2   // tree1
  if (score <= 6) return 3   // tree2
  if (score <= 9) return 4   // tree3
  return 5                   // tree4
}

// ── Tree sprites — (0,0) = trunk base / soil centre ───────────────────────────
// All drawn at their natural scale; positioned & animated by the parent.
// Coordinates scaled from SaplingTree.tsx (viewBox 0 0 120 152, ground y=144)
// at 0.26× with the centre at (60,144) → (0,0).

/** Sapling (score 0–1): prominent brown dome + two round leaves. */
function Sapling() {
  return (
    <g>
      {/* Dome — base at cy=0 (tile center) */}
      <path d="M-5,0 C-5,-4.5 -2.8,-6.5 0,-6.5 C2.8,-6.5 5,-4.5 5,0 Z"
        fill="#C0A060" />
      <ellipse cy={0} rx={5} ry={1.2} fill="#B09050" />
      {/* Short stem */}
      <line x1={0} y1={-6.5} x2={0} y2={-9}
        stroke="#7A9848" strokeWidth={1} strokeLinecap="round" />
      {/* Left leaf */}
      <ellipse cx={-2.5} cy={-10} rx={3} ry={2.2}
        fill="#8EC264" transform="rotate(-12 -2.5 -10)" />
      {/* Right leaf */}
      <ellipse cx={ 2.5} cy={-10} rx={3} ry={2.2}
        fill="#8EC264" transform="rotate(12 2.5 -10)" />
      {/* Leaf highlights */}
      <ellipse cx={-2.5} cy={-10.5} rx={1.2} ry={0.9}
        fill="#A8D840" opacity={0.65} transform="rotate(-12 -2.5 -10.5)" />
      <ellipse cx={ 2.5} cy={-10.5} rx={1.2} ry={0.9}
        fill="#A8D840" opacity={0.65} transform="rotate(12 2.5 -10.5)" />
    </g>
  )
}

/** Tree1 (score 2–4): very thin tall trunk + 3 broad palm-style leaves. */
function Tree1() {
  return (
    <g>
      {/* Flat shadow */}
      <ellipse cy={0} rx={4.5} ry={1.8} fill={SOIL_SHADOW} opacity={0.55} />
      {/* Thin trunk */}
      <rect x={-0.9} y={-14} width={1.8} height={14} rx={0.9} fill={TRUNK} />
      {/* Left broad leaf */}
      <ellipse cx={-4.5} cy={-15.5} rx={4.5} ry={2.5}
        fill={LEAF_LIGHT} transform="rotate(-22 -4.5 -15.5)" />
      <ellipse cx={-5}   cy={-16}   rx={2}   ry={1.1}
        fill={LEAF_BRIGHT} opacity={0.55} transform="rotate(-22 -5 -16)" />
      {/* Right broad leaf */}
      <ellipse cx={ 4.5} cy={-15.5} rx={4.5} ry={2.5}
        fill={LEAF_LIGHT} transform="rotate(22 4.5 -15.5)" />
      <ellipse cx={ 5}   cy={-16}   rx={2}   ry={1.1}
        fill={LEAF_BRIGHT} opacity={0.55} transform="rotate(22 5 -16)" />
      {/* Centre upright leaf */}
      <ellipse cy={-18}   rx={2.8} ry={4}   fill={LEAF_LIGHT} />
      <ellipse cy={-18.5} rx={1.2} ry={1.8} fill={LEAF_BRIGHT} opacity={0.55} />
    </g>
  )
}

/** Tree2 (score 5–6): chunky trunk + compact 3-bubble round canopy. */
function Tree2() {
  return (
    <g>
      {/* Shadow */}
      <ellipse cy={0} rx={6} ry={2.2} fill={SOIL_SHADOW} opacity={0.55} />
      {/* Chunky trunk */}
      <rect x={-1.6} y={-13} width={3.2} height={13} rx={1.2} fill={TRUNK} />
      <line x1={-0.5} y1={-12.5} x2={-0.5} y2={-1}
        stroke={TRUNK_LIGHT} strokeWidth={0.9} strokeLinecap="round" opacity={0.45} />
      {/* Lower side blobs */}
      <circle cx={-4.8} cy={-14.5} r={4.2} fill={LEAF_MID} />
      <circle cx={ 4.8} cy={-14.5} r={4.2} fill={LEAF_MID} />
      {/* Central main dome */}
      <circle cy={-17}   r={5.2} fill={LEAF_MID} />
      {/* Upper dome */}
      <circle cy={-21}   r={4}   fill={LEAF_LIGHT} />
      {/* Highlights */}
      <circle cx={-1.8} cy={-20} r={2.2} fill={LEAF_BRIGHT} opacity={0.55} />
      <circle cx={ 1.8} cy={-20} r={2}   fill={LEAF_BRIGHT} opacity={0.5}  />
    </g>
  )
}

/** Tree3 (score 7–9): wider trunk + fuller multi-bubble canopy. */
function Tree3() {
  return (
    <g>
      {/* Shadow */}
      <ellipse cy={0} rx={7.5} ry={2.7} fill={SOIL_SHADOW} opacity={0.55} />
      {/* Trunk */}
      <rect x={-2} y={-15} width={4} height={15} rx={1.4} fill={TRUNK} />
      <line x1={-0.6} y1={-14.5} x2={-0.6} y2={-1}
        stroke={TRUNK_LIGHT} strokeWidth={1} strokeLinecap="round" opacity={0.4} />
      {/* Outer dark base blobs */}
      <circle cx={-6.5} cy={-14} r={4.8} fill={LEAF_DARK} opacity={0.9} />
      <circle cx={ 6.5} cy={-14} r={4.8} fill={LEAF_DARK} opacity={0.9} />
      {/* Lower canopy */}
      <circle cx={-5}   cy={-17} r={5.5} fill={LEAF_MID} />
      <circle cx={ 5}   cy={-17} r={5.5} fill={LEAF_MID} />
      <circle cy={-18.5}         r={7}   fill={LEAF_MID} />
      {/* Upper canopy */}
      <circle cy={-24}           r={5}   fill={LEAF_LIGHT} />
      <circle cx={-2.5} cy={-23} r={3.2} fill={LEAF_LIGHT} />
      <circle cx={ 2.5} cy={-23} r={3.2} fill={LEAF_LIGHT} />
      {/* Highlights */}
      <circle cx={-2.5} cy={-25.5} r={2.2} fill={LEAF_BRIGHT} opacity={0.55} />
      <circle cx={ 2.5} cy={-25.5} r={2}   fill={LEAF_BRIGHT} opacity={0.5}  />
    </g>
  )
}

/** Tree4 (score 10): thick trunk + grass tufts + massive layered canopy. */
function Tree4() {
  return (
    <g>
      {/* Shadow */}
      <ellipse cy={0} rx={10} ry={3.5} fill={SOIL_SHADOW} opacity={0.55} />
      {/* Grass tufts at trunk base */}
      <ellipse cx={-6}  cy={0} rx={2.8} ry={1.3} fill="#5A9820" opacity={0.78} />
      <ellipse cx={ 6}  cy={0} rx={2.8} ry={1.3} fill="#5A9820" opacity={0.78} />
      <ellipse cy={0}          rx={2.2} ry={1.0} fill="#4A8818" opacity={0.62} />
      {/* Trunk */}
      <rect x={-3}   y={-14} width={6}   height={14} rx={2}   fill="#6B3A18" />
      <rect x={-3.8} y={-14} width={1.8} height={14} rx={1}   fill="#3A1E08" opacity={0.5} />
      <line x1={-0.6} y1={-13.5} x2={-0.6} y2={-1.5}
        stroke="#A06030" strokeWidth={0.9} strokeLinecap="round" opacity={0.35} />
      {/* Layer 1 — deepest shadow perimeter */}
      <circle cx={-11} cy={-16} r={5}   fill="#1E4A10" />
      <circle cx={ 11} cy={-16} r={5}   fill="#1E4A10" />
      <circle cx={-7.5} cy={-14} r={6}  fill="#2A5818" />
      <circle cx={ 7.5} cy={-14} r={6}  fill="#2A5818" />
      <circle cy={-15}            r={7.5} fill="#2A5818" />
      {/* Layer 2 — dark forest green */}
      <circle cx={-9}  cy={-21} r={5}   fill="#326820" />
      <circle cx={ 9}  cy={-21} r={5}   fill="#326820" />
      <circle cy={-22}           r={7.5} fill="#3A7222" />
      <circle cx={-5.5} cy={-25} r={5}  fill="#3A7222" />
      <circle cx={ 5.5} cy={-25} r={5}  fill="#3A7222" />
      {/* Layer 3 — mid green */}
      <circle cy={-28}           r={7}   fill="#4E9030" />
      <circle cx={-4.5} cy={-30} r={5.5} fill="#5CA034" />
      <circle cx={ 4.5} cy={-30} r={5.5} fill="#5CA034" />
      <circle cy={-33}           r={6}   fill="#5CA034" />
      {/* Layer 4 — bright lime */}
      <circle cx={-2.5} cy={-35} r={4.5} fill="#72B835" />
      <circle cx={ 2.5} cy={-35} r={4.5} fill="#72B835" />
      <circle cy={-38}            r={5.5} fill="#7EC040" />
      {/* Crown */}
      <circle cx={-1.5} cy={-41} r={3.2} fill="#94CC38" opacity={0.92} />
      <circle cx={ 1.5} cy={-41} r={3.2} fill="#94CC38" opacity={0.92} />
      <circle cy={-43}            r={3.8} fill="#A8D840" />
      <circle cy={-46}            r={2.2} fill="#C0E840" opacity={0.85} />
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

      <div style={{ borderRadius: 12, overflow: 'hidden', background: '#182E14', marginBottom: 10 }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          style={{ display: 'block' }}
          onClick={() => setSelected(null)}
        >
          {paintOrder.map(entry => {
            const { col, row } = entry
            const stage  = toStage(entry.completed, entry.total, entry.isFuture)
            const { x: bx, y: baseBy } = spriteBase(col, row)
            const by = stage === 5 ? baseBy + TH * 0.15 : baseBy
            const isSelected = selected?.date === entry.date
            const grass  = entry.isFuture ? '#527A22' : isSelected ? '#A8DC48' : '#78BA38'
            const delay  = (col + row) * 0.030 + col * 0.003

            return (
              <g key={entry.date}>
                {/* Tile */}
                <polygon
                  points={diamondPoints(col, row)}
                  fill={grass}
                  stroke="rgba(30,60,10,0.42)"
                  strokeWidth={0.5}
                  style={{ cursor: entry.isFuture ? 'default' : 'pointer' }}
                  onClick={entry.isFuture ? undefined : e => { e.stopPropagation(); toggle(entry) }}
                />


                {/* Tree — springs from tile center */}
                {stage > 0 && (
                  <motion.g
                    initial={{ opacity: 0, scale: 0.05 }}
                    animate={{ opacity: 1, scale: 0.65 }}
                    style={{ opacity: 1, transformOrigin: `${bx}px ${by}px`, pointerEvents: 'none' }}
                    transition={{ delay, type: 'spring', stiffness: 160, damping: 18 }}
                  >
                    <g transform={`translate(${bx} ${by})`}>
                      {stage === 1 && <Sapling />}
                      {stage === 2 && <Tree1 />}
                      {stage === 3 && <Tree2 />}
                      {stage === 4 && <Tree3 />}
                      {stage === 5 && <Tree4 />}
                    </g>
                  </motion.g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Selected day info */}
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

      {/* Stats */}
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

      {cycleComplete && (
        <div className="mt-4 rounded-xl bg-accent border border-border p-4">
          <p className="text-[13px] font-medium text-ink mb-1">Your 90-day chapter is complete.</p>
          <p className="text-[12px] text-ink-2 mb-3 leading-relaxed">
            Retake the questionnaire to see how your wellness has shifted and begin your next grove.
          </p>
          <a href="/questionnaire"
            className="inline-flex items-center justify-center w-full bg-ink text-[#F5F0D0] font-medium text-[13px] rounded-full py-2.5 hover:opacity-90 transition-opacity">
            Begin a new chapter
          </a>
        </div>
      )}

      {previousCycles.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setShowPrev(v => !v)}
            className="text-[12px] text-ink-2 underline underline-offset-2 hover:text-ink transition-colors">
            {showPrev ? 'Hide' : 'View'} previous chapters
          </button>
          {showPrev && <div className="mt-3"><PreviousForests cycles={previousCycles} /></div>}
        </div>
      )}
    </div>
  )
}
