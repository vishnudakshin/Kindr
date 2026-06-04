'use client'

import { useState, useMemo } from 'react'
import { SystemCard } from './SystemCard'
import type { SystemDef } from './SystemCard'
import type { BloodPanel, BloodTestResult } from '@/lib/types'

const BG_SOFT  = '#FAF6E3'
const BORDER   = '#D8D0A8'
const INK      = '#2C2A1E'
const INK2     = '#6B6650'
const BLUE_DOT = '#5890B8'

const STATUS_CLR = {
  normal:     '#3A7028',
  borderline: '#C07828',
  abnormal:   '#A83028',
  unknown:    '#6B6650',
} as const

const STATUS_LBL = {
  normal:     'Optimal',
  borderline: 'Needs attention',
  abnormal:   'Action needed',
  unknown:    'No data',
} as const

const B_X = 122.5
const B_Y = 32
const B_W = 115
const B_H = 460
const SC  = B_W / 100

function bp(bx: number, by: number): [number, number] {
  return [Math.round(bx * SC + B_X), Math.round(by * SC + B_Y)]
}

const BOX_W = 110
const BOX_H = 54
const LX    = 4
const RX    = 246
const L_TIP = LX + BOX_W
const R_TIP = RX

interface SysConf {
  id: string; label: string; side: 'left' | 'right'
  panels: string[]; dot: [number, number]; boxY: number
}

const SYSTEMS: SysConf[] = [
  { id: 'thyroid',   label: 'Thyroid',        side: 'left',  panels: ['Thyroid'],                                              dot: bp(50,  79), boxY:  40 },
  { id: 'blood',     label: 'Blood & Immune',  side: 'left',  panels: ['Complete Blood Count', 'Acute Phase Reactants'],        dot: bp(40, 112), boxY: 140 },
  { id: 'liver',     label: 'Liver',           side: 'left',  panels: ['Liver Function'],                                      dot: bp(63, 138), boxY: 248 },
  { id: 'vitamins',  label: 'Vitamins',        side: 'left',  panels: ['Vitamins'],                                            dot: bp(12, 155), boxY: 335 },
  { id: 'heart',     label: 'Heart',           side: 'right', panels: ['Lipids & Cardiac'],                                    dot: bp(44, 103), boxY: 140 },
  { id: 'metabolic', label: 'Metabolic',       side: 'right', panels: ['Metabolic'],                                           dot: bp(52, 150), boxY: 248 },
  { id: 'kidney',    label: 'Kidney',          side: 'right', panels: ['Kidney Function', 'Urinalysis'],                       dot: bp(59, 165), boxY: 332 },
]

type Status = 'normal' | 'borderline' | 'abnormal' | 'unknown'

function combineTests(panel: BloodPanel, keys: string[]): Record<string, BloodTestResult> {
  const out: Record<string, BloodTestResult> = {}
  for (const key of keys) if (panel[key]) Object.assign(out, panel[key])
  return out
}

function systemStatus(tests: Record<string, BloodTestResult>): Status {
  const vals = Object.values(tests).map(t => t.status).filter(Boolean) as string[]
  if (!vals.length) return 'unknown'
  if (vals.includes('abnormal'))   return 'abnormal'
  if (vals.includes('borderline')) return 'borderline'
  return 'normal'
}

function markerSummary(tests: Record<string, BloodTestResult>): string {
  const all    = Object.values(tests).filter(t => t.value !== '')
  const total  = all.length
  const def    = all.filter(t => t.status === 'borderline' || t.status === 'abnormal').length
  return `${total} marker${total !== 1 ? 's' : ''} · ${def === 0 ? 'all in range' : `${def} deficient`}`
}

function BodyFigure() {
  return (
    <svg x={B_X} y={B_Y} width={B_W} height={B_H} viewBox="0 0 100 400">
      <defs>
        <pattern id="blueDot" x="0" y="0" width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.08" fill={BLUE_DOT} />
        </pattern>
        <clipPath id="figClip">
          <ellipse cx="50" cy="48" rx="22" ry="25" />
          <rect x="43" y="71" width="14" height="13" rx="4" />
          <path d="M26,84 L74,84 C80,84 84,90 84,100 L83,155 C82,165 79,172 78,183 C78,195 79,205 78,213 C78,221 72,228 65,230 L58,230 C56,232 54,234 50,234 C46,234 44,232 42,230 L35,230 C28,228 22,221 22,213 C21,205 22,195 22,183 C21,172 18,165 17,155 L16,100 C16,90 20,84 26,84 Z" />
          <path d="M26,86 C18,86 11,93 10,108 L10,172 C10,181 16,186 22,184 L26,165 C20,160 18,150 17,140 L17,102 Z" />
          <path d="M74,86 C82,86 89,93 90,108 L90,172 C90,181 84,186 78,184 L74,165 C80,160 82,150 83,140 L83,102 Z" />
          <path d="M22,228 L44,228 L44,390 C44,396 39,400 33,400 C27,400 22,396 22,390 Z" />
          <path d="M56,228 L78,228 L78,390 C78,396 73,400 67,400 C61,400 56,396 56,390 Z" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="100" height="400" fill="url(#blueDot)" clipPath="url(#figClip)" />
    </svg>
  )
}

interface BoxProps {
  sys: SysConf; status: Status; summary: string
  onSelect: (e: React.MouseEvent<SVGGElement>) => void
}

function AnnBox({ sys, status, summary, onSelect }: BoxProps) {
  const bx = sys.side === 'left' ? LX : RX
  const by = sys.boxY
  const tx = bx + 9
  const clr = STATUS_CLR[status]
  return (
    <g onClick={onSelect} style={{ cursor: 'pointer' }}>
      <rect x={bx} y={by} width={BOX_W} height={BOX_H} rx={8} fill={BG_SOFT} stroke={BORDER} strokeWidth={0.75} />
      <text x={tx} y={by + 17} fontSize={11} fontWeight="600" fill={INK} fontFamily="system-ui, -apple-system, sans-serif">{sys.label}</text>
      <text x={tx} y={by + 30} fontSize={10} fill={clr} fontFamily="system-ui, -apple-system, sans-serif">{STATUS_LBL[status]}</text>
      <text x={tx} y={by + 43} fontSize={9} fill={INK2} fontFamily="system-ui, -apple-system, sans-serif">{summary}</text>
    </g>
  )
}

export function BodyModel({ bloodPanel }: { bloodPanel: BloodPanel }) {
  const [active, setActive] = useState<SysConf | null>(null)
  const entries = useMemo(() =>
    SYSTEMS.map(sys => {
      const tests   = combineTests(bloodPanel, sys.panels)
      const status  = systemStatus(tests)
      const summary = markerSummary(tests)
      return { sys, tests, status, summary }
    }),
    [bloodPanel],
  )
  const activeTests = active ? combineTests(bloodPanel, active.panels) : {}
  const activeDef: SystemDef | null = active
    ? { id: active.id, label: active.label, side: active.side, yPct: 0, panels: active.panels }
    : null

  return (
    <div className="relative">
      <svg viewBox="0 0 360 510" width="100%" style={{ display: 'block' }} onClick={() => setActive(null)}>
        <BodyFigure />
        {entries.map(({ sys, status, summary }) => {
          const [dx, dy] = sys.dot
          const clr   = STATUS_CLR[status]
          const lineX = sys.side === 'left' ? L_TIP : R_TIP
          const lineY = sys.boxY + BOX_H / 2
          return (
            <g key={sys.id}>
              <line x1={lineX} y1={lineY} x2={dx} y2={dy} stroke={clr} strokeWidth={1.2} strokeLinecap="round" />
              <circle cx={dx} cy={dy} r={5}   fill="white" opacity={0.88} />
              <circle cx={dx} cy={dy} r={3.5} fill={clr} />
              <AnnBox sys={sys} status={status} summary={summary} onSelect={e => { e.stopPropagation(); setActive(sys) }} />
            </g>
          )
        })}
      </svg>
      {activeDef && (
        <SystemCard system={activeDef} tests={activeTests} onClose={() => setActive(null)} />
      )}
    </div>
  )
}
