'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconX } from '@tabler/icons-react'
import { bodySystems, STATUS_META, mockData, labInterp, type BodySystem, type SystemStatus } from '@/lib/data'
import type { BiomarkerStatus, BiomarkerTier } from '@/lib/lab-interpretation'

// ── Dev calibration helper ────────────────────────────────────────────────────
const CALIBRATE = false

// ── Layout constants ──────────────────────────────────────────────────────────
const IMG_ASPECT = 1024 / 1536
const CARD_W     = 148
const CARD_H     = 72
const CARD_GAP   = 18
const DOT_R      = 5

// ── System id → blood panel group names ──────────────────────────────────────
const SYSTEM_GROUPS: Record<string, string[]> = {
  thyroid:      ['Thyroid'],
  liver:        ['Liver Function'],
  blood:        ['Complete Blood Count'],
  vitamins:     ['Vitamins & Minerals'],
  hormones:     ['Stress Hormones', 'Hormones · Optional'],
  heart:        ['Lipids & Cardiac'],
  kidney:       ['Kidney Function', 'Urinalysis'],
  inflammation: ['Inflammation & Iron Profile'],
  metabolic:    ['Metabolic'],
}

// ── Marker status colour ──────────────────────────────────────────────────────
function tierColor(tier: BiomarkerTier): string {
  if (tier === 'optimal' || tier === 'normal') return '#2E7D32'
  if (tier === 'watch') return '#C77D2E'
  if (tier === 'out_of_range' || tier === 'critical') return '#C0392B'
  return '#9A9478'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function markerLabel(sys: BodySystem): string {
  const n = sys.markerCount
  const d = sys.deficientCount
  return `${n} marker${n !== 1 ? 's' : ''} · ${d === 0 ? 'all in range' : `${d} deficient`}`
}

// ── System detail sheet ───────────────────────────────────────────────────────

function SystemSheet({
  sys,
  bioMarkerMap,
  onClose,
}: {
  sys: BodySystem
  bioMarkerMap: Map<string, BiomarkerStatus>
  onClose: () => void
}) {
  const meta = STATUS_META[sys.status]
  const groups = SYSTEM_GROUPS[sys.id] ?? []

  // Collect all raw panel entries for the relevant groups
  const rows: Array<{ name: string; value: string; unit: string; b: BiomarkerStatus | undefined }> = []
  for (const group of groups) {
    const tests = (mockData.bloodPanel as Record<string, Record<string, { value: string; unit: string }>>)[group] ?? {}
    for (const [name, result] of Object.entries(tests)) {
      rows.push({ name, value: result.value, unit: result.unit, b: bioMarkerMap.get(name) })
    }
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="bd"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(44,42,30,0.28)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        key="sh"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 340 }}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-[20px] border-t border-border"
        style={{ background: '#FFFFFF', boxShadow: '0 -4px 32px rgba(44,42,30,0.12)' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-0.5">
          <div className="w-9 h-[3px] rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-border">
          <div>
            <p className="text-[16px] font-semibold text-ink">{sys.name}</p>
            <p className="text-[12px] font-medium mt-0.5" style={{ color: meta.color }}>
              {meta.label}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-ink-2"
            style={{ background: '#F5F0D0' }}
            aria-label="Close"
          >
            <IconX size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Marker list */}
        <div className="overflow-y-auto" style={{ maxHeight: '55vh' }}>
          {rows.length === 0 ? (
            <p className="text-[13px] text-ink-2 text-center py-8">
              No results recorded yet.
            </p>
          ) : (
            <div className="px-5 pb-8">
              {rows.map(({ name, value, unit, b }) => {
                const tier = b?.tier ?? 'unknown'
                const color = value ? tierColor(tier) : '#9A9478'
                const display = value || '—'
                return (
                  <div
                    key={name}
                    className="flex items-center gap-3 py-3 border-b border-border last:border-0"
                  >
                    <p className="flex-1 text-[13px] text-ink leading-snug">{name}</p>
                    <p
                      className="text-[13px] font-semibold tabular-nums shrink-0"
                      style={{ color }}
                    >
                      {display}
                      {value && unit && (
                        <span className="text-[11px] font-normal ml-0.5 opacity-80">{unit}</span>
                      )}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}

// ── Label card (desktop) ──────────────────────────────────────────────────────

function LabelCard({
  sys,
  style,
  onSelect,
}: {
  sys:      BodySystem
  style:    React.CSSProperties
  onSelect: (id: string) => void
}) {
  const meta = STATUS_META[sys.status]
  return (
    <button
      onClick={() => onSelect(sys.id)}
      className="absolute rounded-xl border text-left transition-opacity hover:opacity-80 active:opacity-70"
      style={{
        width:       CARD_W,
        height:      CARD_H,
        background:  '#FAF6E3',
        borderColor: '#D8D0A8',
        boxShadow:   '0 1px 6px rgba(44,42,30,0.08)',
        padding:     '10px 12px',
        cursor:      'pointer',
        ...style,
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 700, color: '#2C2A1E', lineHeight: 1.2, marginBottom: 3 }}>
        {sys.name}
      </p>
      <p style={{ fontSize: 11, color: meta.color, fontWeight: 500, lineHeight: 1.2, marginBottom: 3 }}>
        {meta.label}
      </p>
      <p style={{ fontSize: 10, color: '#6B6650', lineHeight: 1.3 }}>
        {markerLabel(sys)}
      </p>
    </button>
  )
}

// ── Mobile system row ─────────────────────────────────────────────────────────

function MobileRow({ sys, onSelect }: { sys: BodySystem; onSelect: (id: string) => void }) {
  const meta = STATUS_META[sys.status]
  return (
    <button
      onClick={() => onSelect(sys.id)}
      className="w-full flex items-center gap-3 py-3 border-b border-border last:border-0 text-left"
    >
      <div
        className="shrink-0 rounded-full border-2 border-white"
        style={{
          width: DOT_R * 2, height: DOT_R * 2, background: meta.color,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
        }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-ink leading-tight">{sys.name}</p>
        <p className="text-[11px] leading-tight mt-0.5" style={{ color: meta.color }}>{meta.label}</p>
        <p className="text-[10px] text-ink-2 mt-0.5">{markerLabel(sys)}</p>
      </div>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 text-ink-2 opacity-40">
        <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

// ── BodyModel ─────────────────────────────────────────────────────────────────

export function BodyModel() {
  const rootRef  = useRef<HTMLDivElement>(null)
  const figRef   = useRef<HTMLDivElement>(null)

  const [fig, setFig]     = useState({ left: 0, top: 0, w: 0, h: 0 })
  const [rootW, setRootW] = useState(0)
  const [calibXY, setCalibXY] = useState<{ x: number; y: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedSys = selectedId ? bodySystems.find(s => s.id === selectedId) ?? null : null

  // Build biomarker lookup once
  const bioMarkerMap = new Map<string, BiomarkerStatus>(
    labInterp.biomarkers.map(b => [b.name, b])
  )

  const measure = useCallback(() => {
    const root = rootRef.current
    const f    = figRef.current
    if (!root || !f) return
    const rr = root.getBoundingClientRect()
    const fr = f.getBoundingClientRect()
    setFig({ left: fr.left - rr.left, top: fr.top - rr.top, w: fr.width, h: fr.height })
    setRootW(rr.width)
  }, [])

  useEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (rootRef.current) ro.observe(rootRef.current)
    return () => ro.disconnect()
  }, [measure])

  const hasFig = fig.w > 0

  function px(sys: BodySystem) {
    return {
      x: fig.left + fig.w * (sys.anchor.x / 100),
      y: fig.top  + fig.h * (sys.anchor.y / 100),
    }
  }

  const leftSys  = bodySystems.filter(s => s.side === 'left')
  const rightSys = bodySystems.filter(s => s.side === 'right')

  const leftCardTops  = leftSys.map(s => fig.top + fig.h * (s.anchor.y / 100) - CARD_H / 2)
  const rightCardTops = rightSys.map(s => fig.top + fig.h * (s.anchor.y / 100) - CARD_H / 2)

  const cardRightX = fig.left - CARD_GAP
  const cardLeftX  = fig.left + fig.w + CARD_GAP

  function leftLine(sys: BodySystem): string {
    const { x: mx, y: my } = px(sys)
    return `${cardRightX},${my} ${mx},${my}`
  }
  function rightLine(sys: BodySystem): string {
    const { x: mx, y: my } = px(sys)
    return `${mx},${my} ${cardLeftX},${my}`
  }

  const lastLeftBottom  = leftCardTops.length  ? leftCardTops[leftCardTops.length - 1]  + CARD_H : 0
  const lastRightBottom = rightCardTops.length ? rightCardTops[rightCardTops.length - 1] + CARD_H : 0
  const minH = Math.max(fig.top + fig.h + 20, lastLeftBottom + 12, lastRightBottom + 12)

  function onCalibMove(e: React.MouseEvent) {
    if (!CALIBRATE || !figRef.current) return
    const fr = figRef.current.getBoundingClientRect()
    setCalibXY({ x: (e.clientX - fr.left) / fr.width * 100, y: (e.clientY - fr.top) / fr.height * 100 })
  }
  function onCalibClick() {
    if (!CALIBRATE || !calibXY) return
    const txt = `{ x: ${calibXY.x.toFixed(1)}, y: ${calibXY.y.toFixed(1)} }`
    navigator.clipboard?.writeText(txt)
    console.log('anchor:', txt)
  }

  return (
    <>
      {/* ── Desktop / tablet layout (≥700px) ── */}
      <div
        ref={rootRef}
        className="relative mx-auto max-w-[960px] hidden min-[700px]:block"
        style={{ minHeight: minH || 580, background: 'var(--bg)' }}
      >
        <div
          ref={figRef}
          className="absolute left-1/2 -translate-x-1/2 top-5"
          style={{ height: 'min(650px, 67vw)', width: `calc(min(650px, 67vw) * ${IMG_ASPECT})` }}
          onMouseMove={onCalibMove}
          onClick={onCalibClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/body/figure.png"
            alt="Stippled human figure"
            onLoad={measure}
            style={{ width: '100%', height: '100%', display: 'block', userSelect: 'none' }}
          />
          {CALIBRATE && calibXY && (
            <>
              <div className="pointer-events-none absolute" style={{ left: `${calibXY.x}%`, top: 0, bottom: 0, width: 1, background: 'red', opacity: 0.6 }} />
              <div className="pointer-events-none absolute" style={{ top: `${calibXY.y}%`, left: 0, right: 0, height: 1, background: 'red', opacity: 0.6 }} />
            </>
          )}
        </div>

        {/* SVG connector lines */}
        {hasFig && (
          <svg className="absolute inset-0 pointer-events-none" width={rootW} height={minH || 580} style={{ overflow: 'visible' }}>
            {leftSys.map(sys => (
              <polyline key={sys.id} points={leftLine(sys)} fill="none"
                stroke={STATUS_META[sys.status].color} strokeWidth={1.3}
                strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {rightSys.map(sys => (
              <polyline key={sys.id} points={rightLine(sys)} fill="none"
                stroke={STATUS_META[sys.status].color} strokeWidth={1.3}
                strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
        )}

        {/* Marker dots */}
        {hasFig && bodySystems.map(sys => {
          const { x, y } = px(sys)
          return (
            <div key={`dot-${sys.id}`} className="absolute rounded-full pointer-events-none"
              style={{ left: x - DOT_R, top: y - DOT_R, width: DOT_R * 2, height: DOT_R * 2,
                background: STATUS_META[sys.status].color,
                outline: '2px solid white', outlineOffset: '0px',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.10)' }} />
          )
        })}

        {/* Left label cards */}
        {hasFig && leftSys.map((sys, i) => (
          <LabelCard key={sys.id} sys={sys} onSelect={setSelectedId}
            style={{ top: leftCardTops[i], right: rootW - cardRightX }} />
        ))}

        {/* Right label cards */}
        {hasFig && rightSys.map((sys, i) => (
          <LabelCard key={sys.id} sys={sys} onSelect={setSelectedId}
            style={{ top: rightCardTops[i], left: cardLeftX }} />
        ))}

        {CALIBRATE && calibXY && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-lg px-3 py-2 text-xs font-mono text-white pointer-events-none" style={{ background: 'rgba(0,0,0,0.75)' }}>
            x: {calibXY.x.toFixed(1)}%&nbsp;&nbsp;y: {calibXY.y.toFixed(1)}% · click to copy
          </div>
        )}
      </div>

      {/* ── Mobile layout (<700px) ── */}
      <div className="min-[700px]:hidden">
        <div className="flex justify-center mb-5">
          <div style={{ height: 300, width: 300 * IMG_ASPECT }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/body/figure.png" alt="Stippled human figure"
              style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border shadow-card px-4 py-1">
          {bodySystems.map(sys => (
            <MobileRow key={sys.id} sys={sys} onSelect={setSelectedId} />
          ))}
        </div>
      </div>

      {/* ── System detail sheet (both layouts) ── */}
      <AnimatePresence>
        {selectedSys && (
          <SystemSheet
            key="sheet"
            sys={selectedSys}
            bioMarkerMap={bioMarkerMap}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
