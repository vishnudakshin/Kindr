'use client'

import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  completionToStage, STAGE_SCALE, STAGE_CONES,
  type GrowthStage,
} from '@/lib/scoring'
import type { GroveDay } from '@/lib/data'

// ── Grid geometry constants ───────────────────────────────────────────────────

const COLS   = 10
const ROWS   = 9
const TILE_W = 64          // isometric tile width in SVG units
const TILE_H = TILE_W / 2  // 32 — classic 2:1 isometric
const HW     = TILE_W / 2  // 32, half width
const HH     = TILE_H / 2  // 16, half height
const SIDE_H = 44          // block depth

// Origin: leftmost tile vertex at x = 0
const OX = ROWS * HW        // 288
const OY = 88               // headroom above tile(0,0) for tallest tree

// SVG canvas
const SVG_W = (COLS + ROWS) * HW        // 608
const SVG_H = OY + (COLS + ROWS) * HH + TILE_H + SIDE_H + 12  // 436

// Top-surface rhombus corners (for side faces)
const C_TOP   = { x: OX,                  y: OY }             // (288, 88)
const C_RIGHT = { x: OX + COLS * HW,      y: OY + COLS * HH } // (608, 248)
const C_FRONT = { x: OX + (COLS - ROWS) * HW, y: OY + (COLS + ROWS) * HH + TILE_H }
//   tile(9,8) bottom: x=288+(9-8)*32=320, y=88+(9+8)*16+32=88+272+32=392
const C_LEFT  = { x: 0,                   y: OY + ROWS * HH } // (0, 232)

// Recompute C_FRONT properly:
// tile(9,8) bottom = (OX+(9-8)*HW, OY+(9+8)*HH+TILE_H) = (320, 392)
const FRONT_X = OX + (COLS - ROWS) * HW   // 288 + (10-9)*32 = 320
const FRONT_Y = OY + (COLS + ROWS) * HH + TILE_H // 88+17*16+32 = 88+272+32 = 392

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Stable per-tile seeded random in [0, 1). */
function seeded(i: number, salt = 0): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Isometric top vertex of tile (col, row). */
function tileTop(col: number, row: number) {
  return { x: OX + (col - row) * HW, y: OY + (col + row) * HH }
}

/** SVG polygon points string for one tile diamond. */
function diamondPts(col: number, row: number): string {
  const { x, y } = tileTop(col, row)
  return `${x},${y} ${x + HW},${y + HH} ${x},${y + TILE_H} ${x - HW},${y + HH}`
}

/** Screen position of a tree's trunk base. */
function spriteBase(col: number, row: number) {
  const { x, y } = tileTop(col, row)
  return { x, y: y + TILE_H * 0.65 }
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** One cone layer: main ellipse + highlight ellipse + specular spot. */
function Cone({
  cy, rx, ry,
  base, mid, spec,
}: {
  cy: number; rx: number; ry: number
  base: string; mid: string; spec: string
}) {
  return (
    <>
      <ellipse cy={cy}             rx={rx}        ry={ry}        fill={base} />
      <ellipse cy={cy - ry * 0.18} rx={rx * 0.68} ry={ry * 0.62} fill={mid} />
      <ellipse cx={-rx * 0.22} cy={cy - ry * 0.42} rx={rx * 0.28} ry={ry * 0.24} fill={spec} opacity={0.72} />
    </>
  )
}

/** Tree drawn at natural scale=1.0. (0,0) = trunk base. */
function TreeContent({ cones }: { cones: number }) {
  // Trunk
  const TH = 12, TW = 4
  // Cone centres above trunk top (y negative = upward in SVG)
  const B_CY = -(TH + 7),  B_RX = 13,   B_RY = 8.5   // bottom / widest cone
  const M_CY = -(TH + 18), M_RX = 9.5,  M_RY = 7      // mid cone
  const T_CY = -(TH + 27), T_RX = 7,    T_RY = 5.5    // top / narrowest cone

  return (
    <>
      {/* Ground shadow */}
      <ellipse cy={2} rx={14} ry={5} fill="#000" opacity={0.18} />
      {/* Trunk */}
      <rect x={-TW / 2} y={-TH} width={TW} height={TH} rx={1.5} fill="#6B4030" />
      <rect x={-TW / 2 + 0.5} y={-TH + 0.5} width={TW / 2} height={TH - 1.5} rx={1} fill="#9A6040" opacity={0.5} />
      {/* Bottom cone (stages 1–4) */}
      {cones >= 1 && <Cone cy={B_CY} rx={B_RX} ry={B_RY} base="#254D0C" mid="#3D7A1A" spec="#62AA2E" />}
      {/* Mid cone (stages 2–4) */}
      {cones >= 2 && <Cone cy={M_CY} rx={M_RX} ry={M_RY} base="#2A5810" mid="#448C22" spec="#68B234" />}
      {/* Top cone (stage 3 only, slightly brighter) */}
      {cones >= 3 && <Cone cy={T_CY} rx={T_RX} ry={T_RY} base="#2E6214" mid="#4E9828" spec="#72C23C" />}
    </>
  )
}

/** Small recessed dirt circle for empty/future tiles. */
function SoilHole({ future }: { future: boolean }) {
  const op = future ? 0.55 : 0.78
  return (
    <>
      <ellipse cy={1}  rx={10} ry={6} fill="#2A1608" opacity={op * 0.8} />
      <ellipse cy={-1} rx={7}  ry={4} fill="#4A2E14" opacity={op * 0.7} />
      <ellipse cy={-2} rx={4}  ry={2} fill="#6A4220" opacity={op * 0.5} />
    </>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ProgressGroveProps {
  /** Exactly 90 entries; index 0 = day 1. */
  days: GroveDay[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProgressGrove({ days }: ProgressGroveProps) {
  const prefersReduced = useReducedMotion()

  // Build tiles sorted back → front (painter's algorithm)
  const tiles = useMemo(() => {
    const all = Array.from({ length: COLS * ROWS }, (_, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const day = days[i] ?? { date: '', completion: 0, future: true }
      return { col, row, index: i, day }
    })
    return all.sort((a, b) =>
      (a.col + a.row) - (b.col + b.row) || a.col - b.col,
    )
  }, [days])

  // Summary counts for aria-label and caption
  const completedCount = days.filter(d => !d.future && d.completion > 0).length
  const totalDays      = COLS * ROWS

  return (
    <div>
      {/* ── SVG grove ── */}
      <div style={{ borderRadius: 16, overflow: 'hidden', lineHeight: 0 }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          role="img"
          aria-label={`Forest grove showing ${completedCount} of ${totalDays} days completed`}
          style={{ display: 'block' }}
        >
          <defs>
            {/* Grass gradient: lighter at front, slightly deeper at back */}
            <linearGradient id="grassGrad" x1="0" y1={FRONT_Y} x2="0" y2={OY} gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor="#A5D75A" />
              <stop offset="100%" stopColor="#8BC34A" />
            </linearGradient>

            {/* Block side gradient */}
            <linearGradient id="leftFace" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#8B6035" />
              <stop offset="100%" stopColor="#5A3E20" />
            </linearGradient>
            <linearGradient id="rightFace" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#6A4828" />
              <stop offset="100%" stopColor="#452F18" />
            </linearGradient>

            {/* Stipple pattern for soil faces */}
            <pattern id="stipple" x="0" y="0" width="7" height="7" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.9" fill="rgba(0,0,0,0.18)" />
              <circle cx="5.5" cy="5.5" r="0.7" fill="rgba(0,0,0,0.13)" />
            </pattern>

            {/* Grass lip pattern for top of faces */}
            <pattern id="grassLip" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
              <rect width="5" height="2" fill="#7EC038" opacity="0.55" />
            </pattern>
          </defs>

          {/* ── Backdrop ── */}
          <rect width={SVG_W} height={SVG_H} fill="#1E2E26" />

          {/* Drop shadow ellipse */}
          <ellipse cx={SVG_W / 2} cy={FRONT_Y + SIDE_H + 8} rx={240} ry={20} fill="rgba(0,0,0,0.38)" />

          {/* ── Block faces ── */}
          {/* Front-left face (left diagonal from Left corner → Front corner) */}
          <polygon
            points={`${C_LEFT.x},${C_LEFT.y} ${FRONT_X},${FRONT_Y} ${FRONT_X},${FRONT_Y + SIDE_H} ${C_LEFT.x},${C_LEFT.y + SIDE_H}`}
            fill="url(#leftFace)"
          />
          <polygon
            points={`${C_LEFT.x},${C_LEFT.y} ${FRONT_X},${FRONT_Y} ${FRONT_X},${FRONT_Y + SIDE_H} ${C_LEFT.x},${C_LEFT.y + SIDE_H}`}
            fill="url(#stipple)"
          />
          {/* Grass lip overhang — front-left */}
          <polygon
            points={`${C_LEFT.x},${C_LEFT.y} ${FRONT_X},${FRONT_Y} ${FRONT_X},${FRONT_Y + 5} ${C_LEFT.x},${C_LEFT.y + 5}`}
            fill="#7EC038"
            opacity={0.7}
          />

          {/* Front-right face (Front corner → Right corner) */}
          <polygon
            points={`${FRONT_X},${FRONT_Y} ${C_RIGHT.x},${C_RIGHT.y} ${C_RIGHT.x},${C_RIGHT.y + SIDE_H} ${FRONT_X},${FRONT_Y + SIDE_H}`}
            fill="url(#rightFace)"
          />
          <polygon
            points={`${FRONT_X},${FRONT_Y} ${C_RIGHT.x},${C_RIGHT.y} ${C_RIGHT.x},${C_RIGHT.y + SIDE_H} ${FRONT_X},${FRONT_Y + SIDE_H}`}
            fill="url(#stipple)"
          />
          {/* Grass lip — front-right */}
          <polygon
            points={`${FRONT_X},${FRONT_Y} ${C_RIGHT.x},${C_RIGHT.y} ${C_RIGHT.x},${C_RIGHT.y + 5} ${FRONT_X},${FRONT_Y + 5}`}
            fill="#7EC038"
            opacity={0.55}
          />

          {/* ── Tiles — painter order (back → front) ── */}
          {tiles.map(({ col, row, index, day }) => {
            const stage: GrowthStage = completionToStage(day.completion, day.future)
            const hasTree = stage !== 'none'
            const { x: bx, y: by } = spriteBase(col, row)

            // Per-tile organic jitter
            const jitterRot   = (seeded(index * 7 + 1) - 0.5) * 10   // ±5°
            const jitterScale = 1 + (seeded(index * 7 + 2) - 0.5) * 0.16

            // Final rendered scale
            const targetScale = hasTree ? STAGE_SCALE[stage] * jitterScale : 0

            // Animation: stagger back→front, spring pop
            const staggerDelay = prefersReduced ? 0 : (col + row) * 0.012 + col * 0.003
            const spring = prefersReduced
              ? { duration: 0.25, ease: 'easeOut' as const }
              : { type: 'spring' as const, stiffness: 220, damping: 18, mass: 0.7 }

            // Tile grass color: selected future tiles slightly dimmer
            const grassFill = day.future ? '#78A830' : 'url(#grassGrad)'

            return (
              <g key={`${col}-${row}`}>
                {/* Grass tile */}
                <polygon
                  points={diamondPts(col, row)}
                  fill={grassFill}
                  stroke="rgba(60,100,20,0.30)"
                  strokeWidth={0.5}
                />

                {/* Soil hole or tree at sprite base */}
                <g transform={`translate(${bx} ${by})`}>
                  {!hasTree && <SoilHole future={!!day.future} />}
                </g>

                {/* Tree — positioned at sprite base, jitter-rotated, spring-animated */}
                {hasTree && (
                  <motion.g
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: targetScale }}
                    style={{ transformOrigin: `${bx}px ${by}px` }}
                    transition={{ ...spring, delay: staggerDelay }}
                  >
                    <g transform={`translate(${bx} ${by}) rotate(${jitterRot})`}>
                      <TreeContent cones={STAGE_CONES[stage]} />
                    </g>
                  </motion.g>
                )}
              </g>
            )
          })}

          {/* ── Dimension brackets ── */}
          {/* "10" along front-left edge */}
          <g opacity={0.75}>
            <line x1={C_LEFT.x} y1={C_LEFT.y + SIDE_H + 6} x2={FRONT_X} y2={FRONT_Y + SIDE_H + 6}
              stroke="#5FD0A0" strokeWidth={1} />
            <line x1={C_LEFT.x} y1={C_LEFT.y + SIDE_H + 3} x2={C_LEFT.x} y2={C_LEFT.y + SIDE_H + 9}
              stroke="#5FD0A0" strokeWidth={1} />
            <line x1={FRONT_X} y1={FRONT_Y + SIDE_H + 3} x2={FRONT_X} y2={FRONT_Y + SIDE_H + 9}
              stroke="#5FD0A0" strokeWidth={1} />
            <text
              x={(C_LEFT.x + FRONT_X) / 2 - 10}
              y={FRONT_Y + SIDE_H + 22}
              fill="#5FD0A0" fontSize={12} fontWeight={600} fontFamily="sans-serif"
            >10</text>
          </g>
          {/* "9" along front-right edge */}
          <g opacity={0.75}>
            <line x1={FRONT_X} y1={FRONT_Y + SIDE_H + 6} x2={C_RIGHT.x} y2={C_RIGHT.y + SIDE_H + 6}
              stroke="#5FD0A0" strokeWidth={1} />
            <line x1={FRONT_X} y1={FRONT_Y + SIDE_H + 3} x2={FRONT_X} y2={FRONT_Y + SIDE_H + 9}
              stroke="#5FD0A0" strokeWidth={1} />
            <line x1={C_RIGHT.x} y1={C_RIGHT.y + SIDE_H + 3} x2={C_RIGHT.x} y2={C_RIGHT.y + SIDE_H + 9}
              stroke="#5FD0A0" strokeWidth={1} />
            <text
              x={(FRONT_X + C_RIGHT.x) / 2 + 2}
              y={C_RIGHT.y + SIDE_H + 22}
              fill="#5FD0A0" fontSize={12} fontWeight={600} fontFamily="sans-serif"
            >9</text>
          </g>
        </svg>
      </div>

      {/* ── Caption (Kindr tokens) ── */}
      <p className="text-[13px] text-ink-2 mt-3 leading-relaxed">
        Your grove is taking root —{' '}
        <span className="text-ink font-medium">{completedCount} of {totalDays} days</span>{' '}
        tended.
      </p>
    </div>
  )
}
