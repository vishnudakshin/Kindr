'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PreviousForests } from './PreviousForests'
import type { AssessmentCycle } from '@/lib/types'

// ── Geometry ──────────────────────────────────────────────────────────────────
// Smaller tiles + shorter trees → compact grove that fits neatly in the card.
// Tile spacing: 28 × 14 px keeps trees visibly separated from each other.

const COLS = 10
const ROWS = 9
const TW   = 28        // isometric diamond width
const TH   = 14        // isometric diamond height (TW/2 → classic 2:1)
const HW   = TW / 2   // 14 – half width
const HH   = TH / 2   // 7  – half height

// Origin: leftmost tile vertex sits at x = 0
const OX = ROWS * HW   // 126
// OY set so that SVG_H / SVG_W ≈ 1.15, matching the reference image's near-square proportions.
// Tallest tree (FullTree) reaches ~42px above its sprite base; tile(0,0) base ≈ OY + 9px.
// OY = 58 → tree top ≈ 58 + 9 − 42 = 25px from SVG top  ✓
const OY = 58

// Canvas bounds
//   width  = (COLS + ROWS) * HW = 19 × 14 = 266
//   height = OY + (COLS+ROWS)×HH + TH + padding
//          = 58 + 119 + 14 + 6 = 197  → ratio 266/233 ≈ 1.14 ✓
const SVG_W = (COLS + ROWS) * HW               // 266
const SVG_H = OY + (COLS + ROWS) * HH + TH + 6 // 233

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

// Trunk base = 65% down the diamond so tree sits on the tile face
function spriteBase(col: number, row: number) {
  const { x, y } = tileTopVertex(col, row)
  return { x, y: y + TH * 0.65 }
}

// ── Tree sprites — (0,0) = trunk base, y-negative = upward ───────────────────
// Each stage is a narrow conifer with clearly separated tiers.
// Max widths stay well within the 28px tile so trees visibly stand apart.

// Trees are narrow conifers — max width well inside the 28px tile so each tree
// is visually isolated from its neighbours. Height grows significantly per stage
// so all four sizes are immediately distinguishable top-to-bottom.

function Sapling() {
  // Stage 1 — tiny sprout, single dome (~13px tall, max width 10px)
  return (
    <g>
      <ellipse cy={1.5} rx={4}   ry={2}   fill="#000" opacity={0.12} />
      <rect x={-1} y={-4} width={2} height={4} rx={1} fill="#8A5830" />
      <ellipse          cy={-7}   rx={5}   ry={3.8} fill="#4E9018" />
      <ellipse cx={-1.5} cy={-8.5} rx={3.2} ry={2.3} fill="#70C028" opacity={0.85} />
      <ellipse          cy={-11}  rx={2.2} ry={1.8} fill="#8ED83A" opacity={0.8} />
      <ellipse          cy={-13}  rx={1.2} ry={1}   fill="#AAEC4A" opacity={0.7} />
    </g>
  )
}

function SmallTree() {
  // Stage 2 — two clearly-separated tiers (~22px tall, max width 14px)
  return (
    <g>
      <ellipse cy={1.5} rx={5.5} ry={2.5} fill="#000" opacity={0.13} />
      <rect x={-1.5} y={-6} width={3} height={6} rx={1.5} fill="#7A4820" />
      {/* Tier 1 */}
      <ellipse          cy={-9}   rx={7}   ry={4.5} fill="#367018" />
      <ellipse cx={-2}  cy={-11}  rx={4.5} ry={2.8} fill="#52A028" opacity={0.85} />
      {/* Tier 2 — clearly narrower and separated */}
      <ellipse          cy={-16}  rx={5}   ry={3.5} fill="#42881E" />
      <ellipse cx={-1.5} cy={-18} rx={3.2} ry={2.2} fill="#60AE2E" opacity={0.85} />
      {/* Tier top */}
      <ellipse          cy={-21}  rx={3}   ry={2.2} fill="#50A024" />
      <ellipse cx={-1}  cy={-22.5} rx={1.8} ry={1.4} fill="#76CA36" opacity={0.85} />
      <ellipse          cy={-24.5} rx={1.2} ry={0.9} fill="#96E044" opacity={0.72} />
    </g>
  )
}

function MedTree() {
  // Stage 3 — three clear tiers + stub branches (~32px tall, max width 17px)
  return (
    <g>
      <ellipse cy={1.5} rx={7}   ry={3.2} fill="#000" opacity={0.14} />
      <rect x={-2} y={-9} width={4} height={9} rx={2} fill="#6B3A18" />
      <line x1={-1.5} y1={-5.5} x2={-5.5} y2={-9.5} stroke="#4A2808" strokeWidth={1.5} strokeLinecap="round" />
      <line x1={ 1.5} y1={-5.5} x2={ 5.5} y2={-9.5} stroke="#4A2808" strokeWidth={1.5} strokeLinecap="round" />
      {/* Tier 1 */}
      <ellipse          cy={-12}  rx={8.5} ry={5.2} fill="#245A0E" />
      <ellipse cx={-2}  cy={-14}  rx={5.5} ry={3.2} fill="#3A7C1E" opacity={0.85} />
      {/* Tier 2 */}
      <ellipse          cy={-19.5} rx={6.2} ry={4}   fill="#2E6E18" />
      <ellipse cx={-1.5} cy={-21.5} rx={4} ry={2.5} fill="#4A9428" opacity={0.85} />
      {/* Tier 3 */}
      <ellipse          cy={-26}  rx={4.5} ry={3}   fill="#38841C" />
      <ellipse cx={-1}  cy={-27.5} rx={2.8} ry={1.8} fill="#58A82C" opacity={0.85} />
      {/* Crown */}
      <ellipse          cy={-30}  rx={2.8} ry={2.2} fill="#44961E" />
      <ellipse cx={-1}  cy={-31.5} rx={1.8} ry={1.4} fill="#68BE30" opacity={0.85} />
      <ellipse          cy={-33.5} rx={1.2} ry={0.9} fill="#88D83C" opacity={0.75} />
    </g>
  )
}

function FullTree() {
  // Stage 4 — four clear tiers, full canopy (~42px tall, max width 19px)
  return (
    <g>
      <ellipse cy={2}   rx={9}   ry={4}   fill="#000" opacity={0.15} />
      <rect x={-2.5} y={-11} width={5} height={11} rx={2.5} fill="#5A3010" />
      <line x1={-2}  y1={-7}  x2={-8}  y2={-13} stroke="#3C2008" strokeWidth={2}   strokeLinecap="round" />
      <line x1={ 2}  y1={-7}  x2={ 8}  y2={-13} stroke="#3C2008" strokeWidth={2}   strokeLinecap="round" />
      {/* Tier 1 — base, widest */}
      <ellipse          cy={-15}  rx={9.5} ry={5.5} fill="#1A4A08" />
      <ellipse cx={-2.5} cy={-17.5} rx={6} ry={3.5} fill="#2C6818" opacity={0.85} />
      {/* Tier 2 */}
      <ellipse          cy={-22.5} rx={7.2} ry={4.5} fill="#235E12" />
      <ellipse cx={-2}  cy={-25}  rx={4.5} ry={2.8} fill="#3A8020" opacity={0.85} />
      {/* Tier 3 */}
      <ellipse          cy={-29.5} rx={5.5} ry={3.5} fill="#2C7018" />
      <ellipse cx={-1.5} cy={-31.5} rx={3.5} ry={2.2} fill="#489428" opacity={0.85} />
      {/* Tier 4 — narrowest */}
      <ellipse          cy={-35.5} rx={3.8} ry={2.8} fill="#368020" />
      <ellipse cx={-1}  cy={-37.5} rx={2.4} ry={1.7} fill="#58AA30" opacity={0.85} />
      {/* Crown */}
      <ellipse          cy={-40}  rx={2.4} ry={1.8} fill="#42901C" />
      <ellipse cx={-1}  cy={-41.5} rx={1.5} ry={1.2} fill="#66C030" opacity={0.85} />
      <ellipse          cy={-43.5} rx={1}   ry={0.8} fill="#86DC3C" opacity={0.75} />
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

  // Painter's algorithm: back-to-front (ascending col+row, then col)
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

            // Stagger: back-to-front diagonal order
            const delay = (col + row) * 0.035 + col * 0.003

            return (
              <g key={entry.date}>
                {/* Tile */}
                <polygon
                  points={diamondPoints(col, row)}
                  fill={grass}
                  stroke="rgba(30,60,10,0.50)"
                  strokeWidth={0.5}
                  style={{ cursor: entry.isFuture ? 'default' : 'pointer' }}
                  onClick={entry.isFuture ? undefined : e => { e.stopPropagation(); toggle(entry) }}
                />

                {/* Soil patch — visible under/without tree */}
                {!entry.isFuture && (
                  <ellipse
                    cx={tx}
                    cy={ty + TH * 0.72}
                    rx={TW * 0.26}
                    ry={TH * 0.26}
                    fill={stage > 0 ? '#8E5818' : '#B86C28'}
                    opacity={stage > 0 ? 0.38 : 0.80}
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* Upright tree — scale spring from base */}
                {stage > 0 && (
                  <motion.g
                    initial={{ opacity: 0, scale: 0.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ transformOrigin: `${bx}px ${by}px`, pointerEvents: 'none' }}
                    transition={{ delay, type: 'spring', stiffness: 150, damping: 18 }}
                  >
                    <g transform={`translate(${bx} ${by})`}>
                      {stage === 1 && <Sapling />}
                      {stage === 2 && <SmallTree />}
                      {stage === 3 && <MedTree />}
                      {stage === 4 && <FullTree />}
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
