'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PreviousForests } from './PreviousForests'
import type { AssessmentCycle } from '@/lib/types'

// ── Isometric grid geometry ───────────────────────────────────────────────────
// Each tile is a diamond (rhombus) in screen space.
// Tile (col, row) top-vertex:
//   tx = OX + (col - row) * HW
//   ty = OY + (col + row) * HH
// Painter order: ascending (col + row), so back tiles render before front.

const COLS  = 10
const ROWS  = 9
const TW    = 36        // full tile width  (diamond horizontal span)
const TH    = 18        // full tile height (diamond vertical span)
const HW    = TW / 2    // 18
const HH    = TH / 2    // 9
const OX    = 162       // SVG x of tile(0,0) top vertex  — centres the grid
const OY    = 56        // SVG y of tile(0,0) top vertex  — headroom for trees

// SVG canvas
// width:  rightmost right-vertex  = OX + (COLS-1)*HW + HW = OX + COLS*HW = 162 + 180 = 342
//         leftmost  left-vertex   = OX - (ROWS-1)*HW - HW = OX - ROWS*HW = 162 - 162 = 0
// height: bottom-vertex of (9,8) = OY + (9+8)*HH + TH = 56 + 153 + 18 = 227  + 6 pad = 233
const SVG_W = 342
const SVG_H = 233

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

// Tile geometry
function tileTopVertex(col: number, row: number) {
  return { x: OX + (col - row) * HW, y: OY + (col + row) * HH }
}

function diamondPoints(col: number, row: number): string {
  const { x, y } = tileTopVertex(col, row)
  return `${x},${y} ${x + HW},${y + HH} ${x},${y + TH} ${x - HW},${y + HH}`
}

// Tree sprite base — where the trunk meets the soil
function spriteBase(col: number, row: number) {
  const { x, y } = tileTopVertex(col, row)
  return { x, y: y + TH * 0.68 }
}

// ── Tree sprites — drawn upright in screen space ──────────────────────────────
// All coordinates are relative to the sprite base (0, 0).
// Negative y = up in SVG = the tree grows upward.

function Sapling() {   // stage 1 — pct > 0
  return (
    <g>
      <ellipse cy={2} rx={5} ry={2.5} fill="#000" opacity={0.12} />
      {/* trunk */}
      <rect x={-1.5} y={-7} width={3} height={7} rx={1.5} fill="#7A4820" />
      {/* canopy — 3 layers */}
      <circle cx={-3} cy={-10} r={4.5} fill="#2D5E14" />
      <circle cx={ 3} cy={-10} r={4.5} fill="#2D5E14" />
      <circle          cy={-12} r={5.5} fill="#3E7820" />
      <circle cx={-2} cy={-15} r={3.5} fill="#52A02A" />
      <circle cx={ 2} cy={-15} r={3.5} fill="#52A02A" />
      <circle          cy={-18} r={4}   fill="#6EC03A" />
      <circle          cy={-21} r={2.5} fill="#8ED448" opacity={0.9} />
    </g>
  )
}

function SmallTree() {  // stage 2 — pct >= 0.4
  return (
    <g>
      <ellipse cy={2} rx={7} ry={3}   fill="#000" opacity={0.13} />
      <rect x={-2} y={-9} width={4} height={9} rx={2} fill="#6B3A18" />
      {/* low canopy */}
      <circle cx={-5} cy={-12} r={5.5} fill="#265A10" />
      <circle cx={ 5} cy={-12} r={5.5} fill="#265A10" />
      <circle          cy={-13} r={7}   fill="#336A18" />
      {/* mid */}
      <circle cx={-4} cy={-19} r={5}   fill="#448028" />
      <circle cx={ 4} cy={-19} r={5}   fill="#448028" />
      <circle          cy={-22} r={6.5} fill="#5A9830" />
      {/* top */}
      <circle cx={-2} cy={-27} r={4}   fill="#72B23C" />
      <circle cx={ 2} cy={-27} r={4}   fill="#72B23C" />
      <circle          cy={-30} r={4.5} fill="#88C845" />
      <circle          cy={-34} r={3}   fill="#A0DA50" opacity={0.9} />
    </g>
  )
}

function MedTree() {    // stage 3 — pct >= 0.7
  return (
    <g>
      <ellipse cy={2} rx={9} ry={4}   fill="#000" opacity={0.14} />
      <rect x={-2.5} y={-11} width={5} height={11} rx={2.5} fill="#5A3010" />
      {/* side branches */}
      <line x1={-2} y1={-7} x2={-8}  y2={-14} stroke="#402008" strokeWidth={2.5} strokeLinecap="round" />
      <line x1={ 2} y1={-7} x2={ 8}  y2={-14} stroke="#402008" strokeWidth={2.5} strokeLinecap="round" />
      {/* low canopy */}
      <circle cx={-8}  cy={-15} r={6}   fill="#1E4A0A" />
      <circle cx={ 8}  cy={-15} r={6}   fill="#1E4A0A" />
      <circle cx={-5}  cy={-16} r={7}   fill="#285E12" />
      <circle cx={ 5}  cy={-16} r={7}   fill="#285E12" />
      <circle           cy={-17} r={9}   fill="#347220" />
      {/* mid */}
      <circle cx={-5}  cy={-25} r={6.5} fill="#44882A" />
      <circle cx={ 5}  cy={-25} r={6.5} fill="#44882A" />
      <circle           cy={-28} r={8}   fill="#56A035" />
      {/* upper */}
      <circle cx={-3}  cy={-34} r={5.5} fill="#6AB83E" />
      <circle cx={ 3}  cy={-34} r={5.5} fill="#6AB83E" />
      <circle           cy={-38} r={6.5} fill="#80CC48" />
      {/* crown */}
      <circle           cy={-44} r={4.5} fill="#98DC52" />
      <circle           cy={-48} r={3}   fill="#B0EA5C" opacity={0.85} />
    </g>
  )
}

function FullOak() {    // stage 4 — pct >= 1.0
  return (
    <g>
      <ellipse cy={2}  rx={12} ry={5}  fill="#000" opacity={0.15} />
      <rect x={-3} y={-13} width={6} height={13} rx={3} fill="#4A2808" />
      {/* branches */}
      <line x1={-2} y1={-8}  x2={-10} y2={-16} stroke="#361E05" strokeWidth={3}   strokeLinecap="round" />
      <line x1={ 2} y1={-8}  x2={ 10} y2={-16} stroke="#361E05" strokeWidth={3}   strokeLinecap="round" />
      <line          y1={-10}           y2={-18} stroke="#361E05" strokeWidth={2.5} strokeLinecap="round" />
      {/* low canopy — deep shadow base */}
      <circle cx={-11} cy={-18} r={7}   fill="#184008" />
      <circle cx={ 11} cy={-18} r={7}   fill="#184008" />
      <circle cx={-7}  cy={-18} r={8}   fill="#215010" />
      <circle cx={ 7}  cy={-18} r={8}   fill="#215010" />
      <circle           cy={-19} r={10}  fill="#2E6018" />
      {/* mid */}
      <circle cx={-6}  cy={-27} r={7.5} fill="#3A7820" />
      <circle cx={ 6}  cy={-27} r={7.5} fill="#3A7820" />
      <circle           cy={-30} r={9.5} fill="#4A9028" />
      {/* upper */}
      <circle cx={-4}  cy={-38} r={6.5} fill="#5EAA34" />
      <circle cx={ 4}  cy={-38} r={6.5} fill="#5EAA34" />
      <circle           cy={-41} r={8}   fill="#72C040" />
      {/* crown */}
      <circle cx={-2}  cy={-48} r={5}   fill="#8AD048" />
      <circle cx={ 2}  cy={-48} r={5}   fill="#8AD048" />
      <circle           cy={-52} r={5.5} fill="#A0DC52" />
      <circle           cy={-57} r={3.5} fill="#B8EC5C" opacity={0.88} />
      <circle           cy={-60} r={2}   fill="#D0F465" opacity={0.75} />
    </g>
  )
}

// ── Entry type ────────────────────────────────────────────────────────────────

interface Entry {
  col: number; row: number
  date: string; isFuture: boolean
  completed: number; total: number
}

// ── Main component ────────────────────────────────────────────────────────────

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

  // Painter's algorithm: render back-to-front (ascending col+row, then col)
  const paintOrder = [...entries].sort((a, b) =>
    (a.col + a.row) - (b.col + b.row) || a.col - b.col
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

            // Stagger delay from back to front within each diagonal
            const delay = (col + row) * 0.038 + col * 0.004

            return (
              <g key={entry.date}>
                {/* Ground tile */}
                <polygon
                  points={diamondPoints(col, row)}
                  fill={grass}
                  stroke="rgba(30,60,10,0.55)"
                  strokeWidth={0.6}
                  style={{ cursor: entry.isFuture ? 'default' : 'pointer' }}
                  onClick={entry.isFuture ? undefined : e => { e.stopPropagation(); toggle(entry) }}
                />

                {/* Soil patch — isometric ellipse on tile face */}
                {!entry.isFuture && (
                  <ellipse
                    cx={tx}
                    cy={ty + TH * 0.72}
                    rx={TW * 0.27}
                    ry={TH * 0.28}
                    fill={stage > 0 ? '#9E6020' : '#C07838'}
                    opacity={stage > 0 ? 0.42 : 0.82}
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* Upright tree sprite — grows in from base */}
                {stage > 0 && (
                  <motion.g
                    initial={{ opacity: 0, scale: 0.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ transformOrigin: `${bx}px ${by}px`, pointerEvents: 'none' }}
                    transition={{ delay, type: 'spring', stiffness: 140, damping: 20 }}
                  >
                    <g transform={`translate(${bx} ${by})`}>
                      {stage === 1 && <Sapling />}
                      {stage === 2 && <SmallTree />}
                      {stage === 3 && <MedTree />}
                      {stage === 4 && <FullOak />}
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
