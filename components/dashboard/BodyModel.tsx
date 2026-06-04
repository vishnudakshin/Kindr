'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { bodySystems, STATUS_META, type BodySystem, type SystemStatus } from '@/lib/data'

// ── Dev calibration helper ────────────────────────────────────────────────────
// Set to true, hover over the figure, click to log + copy an anchor value.
// Remove this block (and CALIBRATE usage below) before shipping.
const CALIBRATE = false

// ── Layout constants ──────────────────────────────────────────────────────────
// Image natural size is 1024×1536 (aspect ≈ 0.667). The figure div uses
// h-[320px] sm:h-[460px] lg:h-[560px]; width = height × 0.667 (object-contain).
const IMG_ASPECT = 1024 / 1536   // ≈ 0.667
const CARD_W     = 148           // label card width, px
const CARD_H     = 72            // label card height, px
const CARD_GAP   = 18            // gap between figure edge and card column
const DOT_R      = 5             // marker dot radius, px

// ── Helpers ───────────────────────────────────────────────────────────────────

function markerLabel(sys: BodySystem): string {
  const n = sys.markerCount
  const d = sys.deficientCount
  return `${n} marker${n !== 1 ? 's' : ''} · ${d === 0 ? 'all in range' : `${d} deficient`}`
}

/** Push card y-positions down until no two overlap. */
function deoverlap(ys: number[]): number[] {
  const res = [...ys]
  for (let i = 1; i < res.length; i++) {
    const minY = res[i - 1] + CARD_H + 8
    if (res[i] < minY) res[i] = minY
  }
  return res
}

// ── Label card ────────────────────────────────────────────────────────────────

function LabelCard({
  sys,
  style,
}: {
  sys:   BodySystem
  style: React.CSSProperties
}) {
  const meta = STATUS_META[sys.status]
  return (
    <div
      className="absolute rounded-xl border pointer-events-none select-none"
      style={{
        width:       CARD_W,
        height:      CARD_H,
        background:  '#FAF6E3',
        borderColor: '#D8D0A8',
        boxShadow:   '0 1px 6px rgba(44,42,30,0.08)',
        padding:     '10px 12px',
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
    </div>
  )
}

// ── Mobile system row (stacked layout) ───────────────────────────────────────

function MobileRow({ sys }: { sys: BodySystem }) {
  const meta = STATUS_META[sys.status]
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div
        className="shrink-0 rounded-full border-2 border-white"
        style={{ width: DOT_R * 2, height: DOT_R * 2, background: meta.color,
                 boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-ink leading-tight">{sys.name}</p>
        <p className="text-[11px] leading-tight mt-0.5" style={{ color: meta.color }}>{meta.label}</p>
        <p className="text-[10px] text-ink-2 mt-0.5">{markerLabel(sys)}</p>
      </div>
    </div>
  )
}

// ── BodyModel ─────────────────────────────────────────────────────────────────

export function BodyModel() {
  const rootRef  = useRef<HTMLDivElement>(null)
  const figRef   = useRef<HTMLDivElement>(null)   // the figure-size container

  // Measured figure box in root-relative px
  const [fig, setFig] = useState({ left: 0, top: 0, w: 0, h: 0 })
  const [rootW, setRootW] = useState(0)

  // Calibration state
  const [calibXY, setCalibXY] = useState<{ x: number; y: number } | null>(null)

  const measure = useCallback(() => {
    const root = rootRef.current
    const f    = figRef.current
    if (!root || !f) return
    const rr = root.getBoundingClientRect()
    const fr = f.getBoundingClientRect()
    setFig({
      left: fr.left - rr.left,
      top:  fr.top  - rr.top,
      w:    fr.width,
      h:    fr.height,
    })
    setRootW(rr.width)
  }, [])

  useEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (rootRef.current) ro.observe(rootRef.current)
    return () => ro.disconnect()
  }, [measure])

  const hasFig = fig.w > 0

  // Anchor → root-relative pixels
  function px(sys: BodySystem) {
    return {
      x: fig.left + fig.w * (sys.anchor.x / 100),
      y: fig.top  + fig.h * (sys.anchor.y / 100),
    }
  }

  // Left / right system groups
  const leftSys  = bodySystems.filter(s => s.side === 'left')
  const rightSys = bodySystems.filter(s => s.side === 'right')

  // Card top positions (de-overlapped)
  const leftCardTops  = deoverlap(leftSys.map(s  => fig.top + fig.h * (s.anchor.y / 100) - CARD_H / 2))
  const rightCardTops = deoverlap(rightSys.map(s => fig.top + fig.h * (s.anchor.y / 100) - CARD_H / 2))

  // Connector lines: straight diagonal from card-edge midpoint to marker dot.
  // Single segment — obtuse angles are fine, no right-angle constraint.
  const cardRightX = fig.left - CARD_GAP
  const cardLeftX  = fig.left + fig.w + CARD_GAP

  function leftLine(sys: BodySystem, cardTop: number): string {
    const { x: mx, y: my } = px(sys)
    const cy = cardTop + CARD_H / 2
    return `${cardRightX},${cy} ${mx},${my}`
  }

  function rightLine(sys: BodySystem, cardTop: number): string {
    const { x: mx, y: my } = px(sys)
    const cy = cardTop + CARD_H / 2
    return `${mx},${my} ${cardLeftX},${cy}`
  }

  // Root container min-height = figure height or last card bottom, whichever is bigger
  const lastLeftBottom  = leftCardTops.length  ? leftCardTops[leftCardTops.length - 1]  + CARD_H : 0
  const lastRightBottom = rightCardTops.length ? rightCardTops[rightCardTops.length - 1] + CARD_H : 0
  const minH = Math.max(fig.top + fig.h + 20, lastLeftBottom + 12, lastRightBottom + 12)

  // Calibration mouse handler
  function onCalibMove(e: React.MouseEvent) {
    if (!CALIBRATE || !figRef.current) return
    const fr = figRef.current.getBoundingClientRect()
    const cx = ((e.clientX - fr.left) / fr.width  * 100)
    const cy = ((e.clientY - fr.top)  / fr.height * 100)
    setCalibXY({ x: cx, y: cy })
  }

  function onCalibClick(e: React.MouseEvent) {
    if (!CALIBRATE || !calibXY) return
    const txt = `{ x: ${calibXY.x.toFixed(1)}, y: ${calibXY.y.toFixed(1)} }`
    navigator.clipboard?.writeText(txt)
    console.log('anchor:', txt)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Desktop / tablet layout (≥700px) ── */}
      <div
        ref={rootRef}
        className="relative mx-auto max-w-[960px] hidden min-[700px]:block"
        style={{ minHeight: minH || 580, background: 'var(--bg)' }}
      >
        {/* Figure image container — centered, height driven by Tailwind */}
        <div
          ref={figRef}
          className="absolute left-1/2 -translate-x-1/2 top-5"
          style={{
            height: 'min(650px, 67vw)',
            width:  `calc(min(650px, 67vw) * ${IMG_ASPECT})`,
          }}
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

          {/* Calibration crosshair */}
          {CALIBRATE && calibXY && (
            <>
              <div
                className="pointer-events-none absolute"
                style={{
                  left: `${calibXY.x}%`, top: 0, bottom: 0,
                  width: 1, background: 'red', opacity: 0.6,
                }}
              />
              <div
                className="pointer-events-none absolute"
                style={{
                  top: `${calibXY.y}%`, left: 0, right: 0,
                  height: 1, background: 'red', opacity: 0.6,
                }}
              />
            </>
          )}
        </div>

        {/* SVG overlay for connector lines */}
        {hasFig && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={rootW}
            height={minH || 580}
            style={{ overflow: 'visible' }}
          >
            {leftSys.map((sys, i) => (
              <polyline
                key={sys.id}
                points={leftLine(sys, leftCardTops[i])}
                fill="none"
                stroke={STATUS_META[sys.status].color}
                strokeWidth={1.3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {rightSys.map((sys, i) => (
              <polyline
                key={sys.id}
                points={rightLine(sys, rightCardTops[i])}
                fill="none"
                stroke={STATUS_META[sys.status].color}
                strokeWidth={1.3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        )}

        {/* Marker dots */}
        {hasFig && bodySystems.map(sys => {
          const { x, y } = px(sys)
          return (
            <div
              key={`dot-${sys.id}`}
              className="absolute rounded-full pointer-events-none"
              style={{
                left:        x - DOT_R,
                top:         y - DOT_R,
                width:       DOT_R * 2,
                height:      DOT_R * 2,
                background:  STATUS_META[sys.status].color,
                outline:     '2px solid white',
                outlineOffset: '0px',
                boxShadow:   '0 0 0 1px rgba(0,0,0,0.10)',
              }}
            />
          )
        })}

        {/* Left label cards */}
        {hasFig && leftSys.map((sys, i) => (
          <LabelCard
            key={sys.id}
            sys={sys}
            style={{
              top:   leftCardTops[i],
              right: rootW - cardRightX,
            }}
          />
        ))}

        {/* Right label cards */}
        {hasFig && rightSys.map((sys, i) => (
          <LabelCard
            key={sys.id}
            sys={sys}
            style={{
              top:  rightCardTops[i],
              left: cardLeftX,
            }}
          />
        ))}

        {/* Calibration tooltip */}
        {CALIBRATE && calibXY && (
          <div
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-lg px-3 py-2 text-xs font-mono text-white pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.75)' }}
          >
            x: {calibXY.x.toFixed(1)}%&nbsp;&nbsp;y: {calibXY.y.toFixed(1)}%
            &nbsp;·&nbsp;click to copy
          </div>
        )}
      </div>

      {/* ── Mobile layout (<700px) ── */}
      <div className="min-[700px]:hidden">
        {/* Smaller figure, centered */}
        <div className="flex justify-center mb-5">
          <div style={{ height: 300, width: 300 * IMG_ASPECT }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/body/figure.png"
              alt="Stippled human figure"
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          </div>
        </div>

        {/* Stacked system list */}
        <div className="bg-card rounded-2xl border border-border shadow-card px-4 py-1">
          {bodySystems.map(sys => (
            <MobileRow key={sys.id} sys={sys} />
          ))}
        </div>
      </div>
    </>
  )
}
