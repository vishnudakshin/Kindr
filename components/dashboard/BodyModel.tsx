'use client'

import { useState } from 'react'
import { SystemCard } from './SystemCard'
import type { SystemDef } from './SystemCard'
import type { BloodPanel, BloodTestResult } from '@/lib/types'

// ── System configuration ──────────────────────────────────────────────────────
// yPct: % of container height where the label is centred (anatomical top→bottom)

const SYSTEMS: SystemDef[] = [
  // LEFT — top to bottom
  { id: 'thyroid',  label: 'Thyroid',        side: 'left',  yPct: 14, panels: ['Thyroid'] },
  { id: 'blood',    label: 'Blood & Immune',  side: 'left',  yPct: 31, panels: ['Complete Blood Count', 'Acute Phase Reactants'] },
  { id: 'liver',    label: 'Liver',           side: 'left',  yPct: 50, panels: ['Liver Function'] },
  { id: 'adrenal',  label: 'Adrenal',         side: 'left',  yPct: 65, panels: ['Hormones'] },
  // RIGHT — top to bottom
  { id: 'heart',    label: 'Heart',           side: 'right', yPct: 31, panels: ['Lipids & Cardiac'] },
  { id: 'metabolic',label: 'Metabolic',       side: 'right', yPct: 46, panels: ['Metabolic'] },
  { id: 'kidney',   label: 'Kidney',          side: 'right', yPct: 60, panels: ['Kidney Function', 'Urinalysis'] },
  { id: 'vitamins', label: 'Vitamins',        side: 'right', yPct: 75, panels: ['Vitamins'] },
]

// ── Status helpers ────────────────────────────────────────────────────────────

type Status = NonNullable<BloodTestResult['status']>

const DOT_CLR: Record<Status | 'unknown', string> = {
  normal:     '#5A7A50',
  borderline: '#B8842A',
  abnormal:   '#A63030',
  unknown:    '#6B6650',
}

function systemStatus(tests: Record<string, BloodTestResult>): Status | 'unknown' {
  const vals = Object.values(tests).map(t => t.status).filter(Boolean) as Status[]
  if (!vals.length) return 'unknown'
  if (vals.includes('abnormal'))   return 'abnormal'
  if (vals.includes('borderline')) return 'borderline'
  return 'normal'
}

function combineTests(
  panel: BloodPanel,
  keys: string[],
): Record<string, BloodTestResult> {
  const out: Record<string, BloodTestResult> = {}
  for (const key of keys) {
    if (panel[key]) Object.assign(out, panel[key])
  }
  return out
}

// ── Human figure SVG ──────────────────────────────────────────────────────────

function HumanFigure() {
  const fill   = '#EDE8CC'
  const stroke = '#C8BFA0'
  const sw     = 1.4

  // All body shapes share one stipple clip
  const bodyShapes = (
    <>
      {/* Head */}
      <ellipse cx="50" cy="48" rx="22" ry="25" />
      {/* Neck */}
      <rect x="43" y="71" width="14" height="13" rx="4" />
      {/* Torso */}
      <path d="M26,84 L74,84 C80,84 84,90 84,100 L83,155 C82,165 79,172 78,183
               C78,195 79,205 78,213 C78,221 72,228 65,230
               L58,230 C56,232 54,234 50,234 C46,234 44,232 42,230
               L35,230 C28,228 22,221 22,213 C21,205 22,195 22,183
               C21,172 18,165 17,155 L16,100 C16,90 20,84 26,84 Z" />
      {/* Left arm */}
      <path d="M26,86 C18,86 11,93 10,108 L10,172 C10,181 16,186 22,184
               L26,165 C20,160 18,150 17,140 L17,102 Z" />
      {/* Right arm */}
      <path d="M74,86 C82,86 89,93 90,108 L90,172 C90,181 84,186 78,184
               L74,165 C80,160 82,150 83,140 L83,102 Z" />
      {/* Left leg */}
      <path d="M22,228 L44,228 L44,390 C44,396 39,400 33,400 C27,400 22,396 22,390 Z" />
      {/* Right leg */}
      <path d="M56,228 L78,228 L78,390 C78,396 73,400 67,400 C61,400 56,396 56,390 Z" />
    </>
  )

  return (
    <svg viewBox="0 0 100 400" className="w-full h-full" fill="none">
      <defs>
        <pattern id="sp" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.55" fill="#6B6650" opacity="0.15" />
        </pattern>
        <clipPath id="bodyClip">
          <ellipse cx="50" cy="48" rx="22" ry="25" />
          <rect x="43" y="71" width="14" height="13" rx="4" />
          <path d="M26,84 L74,84 C80,84 84,90 84,100 L83,155 C82,165 79,172 78,183
                   C78,195 79,205 78,213 C78,221 72,228 65,230
                   L58,230 C56,232 54,234 50,234 C46,234 44,232 42,230
                   L35,230 C28,228 22,221 22,213 C21,205 22,195 22,183
                   C21,172 18,165 17,155 L16,100 C16,90 20,84 26,84 Z" />
          <path d="M26,86 C18,86 11,93 10,108 L10,172 C10,181 16,186 22,184
                   L26,165 C20,160 18,150 17,140 L17,102 Z" />
          <path d="M74,86 C82,86 89,93 90,108 L90,172 C90,181 84,186 78,184
                   L74,165 C80,160 82,150 83,140 L83,102 Z" />
          <path d="M22,228 L44,228 L44,390 C44,396 39,400 33,400 C27,400 22,396 22,390 Z" />
          <path d="M56,228 L78,228 L78,390 C78,396 73,400 67,400 C61,400 56,396 56,390 Z" />
        </clipPath>
      </defs>

      {/* Base fills */}
      <g fill={fill} stroke={stroke} strokeWidth={sw}>
        {bodyShapes}
      </g>

      {/* Stipple texture clipped to body outline */}
      <rect x="0" y="0" width="100" height="400" fill="url(#sp)" clipPath="url(#bodyClip)" />
    </svg>
  )
}

// ── Label chip ────────────────────────────────────────────────────────────────

function LabelChip({
  system,
  status,
  onClick,
}: {
  system: SystemDef
  status: Status | 'unknown'
  onClick: () => void
}) {
  const isLeft = system.side === 'left'

  return (
    <div
      className={`absolute flex items-center ${isLeft ? 'flex-row-reverse' : 'flex-row'}`}
      style={{
        top:   `${system.yPct}%`,
        ...(isLeft
          ? { right: 'calc(50% + 46px)', transform: 'translateY(-50%)' }
          : { left:  'calc(50% + 46px)', transform: 'translateY(-50%)' }),
      }}
    >
      {/* Connector line */}
      <div className="w-5 h-px flex-shrink-0" style={{ background: '#D8D0A8' }} />

      {/* Chip */}
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border shadow-card
          hover:bg-bg active:scale-95 transition-all ${isLeft ? 'flex-row-reverse' : 'flex-row'}`}
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: DOT_CLR[status] }}
        />
        <span className="text-[10.5px] font-medium text-ink whitespace-nowrap leading-none">
          {system.label}
        </span>
      </button>
    </div>
  )
}

// ── Body model ────────────────────────────────────────────────────────────────

export function BodyModel({ bloodPanel }: { bloodPanel: BloodPanel }) {
  const [active, setActive] = useState<SystemDef | null>(null)

  const activeTests = active ? combineTests(bloodPanel, active.panels) : {}

  return (
    <div className="relative" style={{ height: 400 }}>
      {/* Centred figure */}
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-24">
        <HumanFigure />
      </div>

      {/* System labels */}
      {SYSTEMS.map(sys => {
        const tests  = combineTests(bloodPanel, sys.panels)
        const status = systemStatus(tests)
        return (
          <LabelChip
            key={sys.id}
            system={sys}
            status={status}
            onClick={() => setActive(sys)}
          />
        )
      })}

      {/* Drill-down card */}
      {active && (
        <SystemCard
          system={active}
          tests={activeTests}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  )
}
