'use client'

import { useState } from 'react'
import { IconX, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { RangeBar } from './RangeBar'
import { TrendSparkline } from './TrendSparkline'
import type { BloodTestResult } from '@/lib/types'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SystemDef {
  id: string
  label: string
  side: 'left' | 'right'
  yPct: number
  panels: string[]
}

type Status = 'normal' | 'borderline' | 'abnormal'

interface SystemCardProps {
  system: SystemDef
  tests: Record<string, BloodTestResult>
  onClose: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Status, string> = {
  normal:     'All clear',
  borderline: 'Needs attention',
  abnormal:   'Out of range',
}

const STATUS_COLOR: Record<Status, string> = {
  normal:     '#5A7A50',
  borderline: '#B8842A',
  abnormal:   '#A63030',
}

function aggregateStatus(tests: Record<string, BloodTestResult>): Status {
  const vals = Object.values(tests).map(t => t.status).filter(Boolean) as Status[]
  if (vals.includes('abnormal'))   return 'abnormal'
  if (vals.includes('borderline')) return 'borderline'
  return 'normal'
}

function healthScore(tests: Record<string, BloodTestResult>): number {
  const all = Object.values(tests).filter(t => t.status)
  if (!all.length) return 1
  const weighted = all.reduce((sum, t) => {
    if (t.status === 'normal')     return sum + 1
    if (t.status === 'borderline') return sum + 0.5
    return sum
  }, 0)
  return weighted / all.length
}

// ── Health dial (SVG arc) ─────────────────────────────────────────────────────

function HealthDial({ pct, status }: { pct: number; status: Status }) {
  const r = 26, cx = 32, cy = 32
  const circ = 2 * Math.PI * r
  const filled = pct * circ

  return (
    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none">
      <circle cx={cx} cy={cy} r={r} stroke="#E8E0A0" strokeWidth={5} />
      <circle
        cx={cx} cy={cy} r={r}
        stroke={STATUS_COLOR[status]}
        strokeWidth={5}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x={cx} y={cy + 1}
        textAnchor="middle" dominantBaseline="middle"
        fontSize="13" fontWeight="600" fill="#2C2A1E"
        style={{ fontFamily: 'inherit' }}
      >
        {Math.round(pct * 100)}%
      </text>
    </svg>
  )
}

// ── Marker row (expandable) ───────────────────────────────────────────────────

function MarkerRow({ name, result }: { name: string; result: BloodTestResult }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-border last:border-0">
      <button
        className="w-full flex items-center gap-3 py-3 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-ink font-medium leading-tight">{name}</p>
          <p className="text-[11px] text-ink-2 mt-0.5">
            {result.value ? `${result.value}${result.unit ? ' ' + result.unit : ''}` : '—'}
            {result.refRange ? `  ·  ref ${result.refRange}` : ''}
          </p>
        </div>
        <div className="shrink-0 w-28">
          <RangeBar result={result} />
        </div>
        <div className="shrink-0 text-ink-2">
          {open
            ? <IconChevronUp size={14} strokeWidth={1.5} />
            : <IconChevronDown size={14} strokeWidth={1.5} />}
        </div>
      </button>

      {open && (
        <div className="pb-3 flex items-center gap-4">
          <TrendSparkline data={[]} />
          <p className="text-[11px] text-ink-2 leading-relaxed">
            Tracking begins after your next lab.
          </p>
        </div>
      )}
    </div>
  )
}

// ── System card ───────────────────────────────────────────────────────────────

export function SystemCard({ system, tests, onClose }: SystemCardProps) {
  const status  = aggregateStatus(tests)
  const pct     = healthScore(tests)
  const color   = STATUS_COLOR[status]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed bottom-[68px] left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border shadow-[0_-4px_24px_rgba(44,42,30,0.1)] max-h-[70vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="px-6 pb-8">
          {/* Header */}
          <div className="flex items-start justify-between mt-3 mb-5">
            <div className="flex items-center gap-4">
              <HealthDial pct={pct} status={status} />
              <div>
                <h2 className="font-serif text-[22px] font-medium text-ink leading-snug">
                  {system.label}
                </h2>
                <p className="text-[13px] mt-0.5" style={{ color }}>
                  {STATUS_LABEL[status]}
                </p>
              </div>
            </div>
            <button
              className="p-1.5 rounded-full text-ink-2 hover:bg-border/40 transition-colors mt-1"
              onClick={onClose}
            >
              <IconX size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* Markers */}
          <div>
            {Object.entries(tests).map(([name, result]) => (
              <MarkerRow key={name} name={name} result={result} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
