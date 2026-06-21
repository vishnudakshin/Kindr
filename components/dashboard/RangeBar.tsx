import type { BloodTestResult } from '@/lib/types'
import type { BiomarkerStatus, BiomarkerTier } from '@/lib/lab-interpretation'
import type { NumericRange, Direction } from '@/lib/lab-config'

// ── Zone colours ──────────────────────────────────────────────────────────────

const C_GOOD    = '#4E7A40'  // muted green  — optimal / good
const C_WATCH   = '#C99830'  // warm amber   — borderline / watch
const C_BAD     = '#C05050'  // muted red    — out of range / bad
const C_NEUTRAL = '#9A9478'  // parchment    — unknown / fallback

// ── Per-marker zone labels ────────────────────────────────────────────────────
// Labels are always LEFT-TO-RIGHT for the rendered bar:
//   high_bad  → GREEN | AMBER | RED  : labels = [green_label, amber_label, red_label]
//   low_bad   → RED | AMBER | GREEN  : labels = [red_label,   amber_label, green_label]
//   two_sided → RED | … | GREEN | … | RED : labels = [left_red, center_green, right_red]

const ZONE_LABELS: Record<string, [string, string, string]> = {
  // low_bad  [RED | AMBER | GREEN]
  'Vitamin D (25-OH)': ['deficient',   'insufficient', 'optimal'   ],
  'Vitamin B12':       ['low',         'borderline',   'optimal'   ],
  'Folate (B9)':       ['low',         'borderline',   'optimal'   ],
  'Haemoglobin':       ['low',         'borderline',   'optimal'   ],
  'Haematocrit':       ['low',         'borderline',   'optimal'   ],
  'HDL':               ['low',         'acceptable',   'normal'    ],
  'eGFR':              ['low',         'borderline',   'optimal'   ],
  // high_bad [GREEN | AMBER | RED]
  'Fasting Insulin':   ['optimal',     'at risk',      'high'      ],
  'HOMA-IR':           ['optimal',     'at risk',      'high'      ],
  'Fasting Glucose':   ['optimal',     'borderline',   'high'      ],
  'HbA1c':             ['optimal',     'pre-diabetic', 'diabetic'  ],
  'LDL':               ['optimal',     'borderline',   'high'      ],
  'Total Cholesterol': ['optimal',     'borderline',   'high'      ],
  'Triglycerides':     ['optimal',     'borderline',   'high'      ],
  'hs-CRP':            ['optimal',     'borderline',   'high risk' ],
  'Non-HDL':           ['optimal',     'borderline',   'high'      ],
  'TG/HDL Ratio':      ['optimal',     'borderline',   'high'      ],
  'TC/HDL Ratio':      ['optimal',     'borderline',   'high'      ],
  'ApoB':              ['optimal',     'borderline',   'high'      ],
  'Uric Acid':         ['optimal',     'borderline',   'high'      ],
  'ALT':               ['optimal',     'borderline',   'high'      ],
  'AST':               ['optimal',     'borderline',   'high'      ],
  'GGT':               ['optimal',     'borderline',   'high'      ],
  'Lp(a)':             ['optimal',     'borderline',   'high'      ],
  // two_sided [RED | … | GREEN | … | RED]
  'TSH':               ['too low',     'optimal',      'too high'  ],
  'Ferritin':          ['low',         'optimal',      'elevated'  ],
  'Morning Cortisol':  ['too low',     'optimal',      'too high'  ],
  'NLR':               ['too low',     'optimal',      'high'      ],
  'White Blood Cells': ['too low',     'normal',       'too high'  ],
  'Absolute Neutrophil Count': ['too low', 'normal',   'too high'  ],
  'Neutrophils':       ['too low',     'normal',       'too high'  ],
  'Lymphocytes':       ['too low',     'normal',       'too high'  ],
  'Monocytes':         ['too low',     'normal',       'too high'  ],
  'Eosinophils':       ['low',         'normal',       'elevated'  ],
  'MCV':               ['low',         'normal',       'elevated'  ],
  'MCH':               ['low',         'normal',       'elevated'  ],
  'MCHC':              ['low',         'normal',       'elevated'  ],
  'Platelets':         ['low',         'normal',       'elevated'  ],
  'SHBG':              ['low',         'normal',       'elevated'  ],
}

function getLabels(name: string, direction: Direction): [string, string, string] {
  if (ZONE_LABELS[name]) return ZONE_LABELS[name]
  if (direction === 'low_bad')  return ['low',     'borderline', 'optimal']
  if (direction === 'high_bad') return ['optimal', 'borderline', 'high']
  return ['too low', 'optimal', 'too high']  // two_sided default
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1000) return String(Math.round(n))
  if (n % 1 === 0) return String(n)
  return n < 1 ? n.toFixed(2) : n.toFixed(1)
}

function pctOf(v: number, lo: number, hi: number): number {
  return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))
}

// ── Zone definition ───────────────────────────────────────────────────────────

interface Zone { lo: number; hi: number; color: string; label: string }

function buildZones(
  direction: Direction,
  ref: NumericRange | null,
  opt: NumericRange | null,
  trackLo: number,
  trackHi: number,
  labels: [string, string, string],  // positional: [left_zone, middle_zone, right_zone]
): Zone[] {
  if (direction === 'high_bad') {
    // left=GREEN(labels[0]) | middle=AMBER(labels[1]) | right=RED(labels[2])
    const optHi = opt?.high
    const refHi = ref?.high
    if (optHi !== undefined && refHi !== undefined) {
      return [
        { lo: trackLo, hi: optHi,   color: C_GOOD,  label: labels[0] },
        { lo: optHi,   hi: refHi,   color: C_WATCH, label: labels[1] },
        { lo: refHi,   hi: trackHi, color: C_BAD,   label: labels[2] },
      ].filter(z => z.hi > z.lo)
    }
    if (refHi !== undefined) return [
      { lo: trackLo, hi: refHi,   color: C_GOOD, label: labels[0] },
      { lo: refHi,   hi: trackHi, color: C_BAD,  label: labels[2] },
    ].filter(z => z.hi > z.lo)
  }

  if (direction === 'low_bad') {
    // left=RED(labels[0]) | middle=AMBER(labels[1]) | right=GREEN(labels[2])
    const refLo = ref?.low
    const optLo = opt?.low
    if (refLo !== undefined && optLo !== undefined && optLo >= refLo) {
      return [
        { lo: trackLo, hi: refLo,   color: C_BAD,   label: labels[0] },
        { lo: refLo,   hi: optLo,   color: C_WATCH, label: labels[1] },
        { lo: optLo,   hi: trackHi, color: C_GOOD,  label: labels[2] },
      ].filter(z => z.hi > z.lo)
    }
    if (refLo !== undefined) return [
      { lo: trackLo, hi: refLo,   color: C_BAD,  label: labels[0] },
      { lo: refLo,   hi: trackHi, color: C_GOOD, label: labels[2] },
    ].filter(z => z.hi > z.lo)
  }

  if (direction === 'two_sided') {
    // left=RED(labels[0]) | … | GREEN(labels[1]) | … | right=RED(labels[2])
    // AMBER zones between ref and opt are labelled 'borderline' (usually narrow → hidden)
    const refLo = ref?.low
    const refHi = ref?.high
    const optLo = opt?.low
    const optHi = opt?.high
    const zones: Zone[] = []

    if (refLo !== undefined) {
      zones.push({ lo: trackLo, hi: refLo, color: C_BAD, label: labels[0] })
      if (optLo !== undefined && optLo > refLo) {
        zones.push({ lo: refLo, hi: optLo, color: C_WATCH, label: 'borderline' })
      }
    }
    const gLo = optLo ?? refLo ?? trackLo
    const gHi = optHi ?? refHi ?? trackHi
    if (gHi > gLo) zones.push({ lo: gLo, hi: gHi, color: C_GOOD, label: labels[1] })
    if (refHi !== undefined) {
      if (optHi !== undefined && optHi < refHi) {
        zones.push({ lo: optHi, hi: refHi, color: C_WATCH, label: 'borderline' })
      }
      zones.push({ lo: refHi, hi: trackHi, color: C_BAD, label: labels[2] })
    }
    return zones.filter(z => z.hi > z.lo)
  }

  return [{ lo: trackLo, hi: trackHi, color: C_NEUTRAL, label: '' }]
}

// ── Track-bound computation ───────────────────────────────────────────────────

function computeTrack(
  value: number,
  ref: NumericRange | null,
  opt: NumericRange | null,
  direction: Direction,
): { lo: number; hi: number } {
  const pts: number[] = [value]
  if (ref?.low  != null) pts.push(ref.low)
  if (ref?.high != null) pts.push(ref.high)
  if (opt?.low  != null) pts.push(opt.low)
  if (opt?.high != null) pts.push(opt.high)

  const dataMin = Math.min(...pts)
  const dataMax = Math.max(...pts)
  const span    = Math.max(dataMax - dataMin, Math.abs(value) * 0.1, 1)

  // One-sided markers start from 0; two-sided get left-padding.
  const rawLo = (direction === 'high_bad' || direction === 'low_bad')
    ? 0
    : Math.max(0, dataMin - span * 0.2)

  return {
    lo: rawLo > 0 ? Math.floor(rawLo * 10) / 10 : 0,
    hi: Math.ceil((dataMax + span * 0.3) * 10) / 10,
  }
}

// Fallback: parse a legacy refRange string into simple zone bounds.
function parseLegacy(refStr: string): { lo: number; hi: number; refLo: number; refHi: number } | null {
  const between = refStr.match(/^([\d.]+)[–\-]([\d.]+)$/)
  if (between) {
    const lo = parseFloat(between[1]), hi = parseFloat(between[2])
    const sp = hi - lo
    return { lo: Math.max(0, lo - sp * 0.35), hi: hi + sp * 0.35, refLo: lo, refHi: hi }
  }
  const lt = refStr.match(/^<\s*([\d.]+)$/)
  if (lt) {
    const hi = parseFloat(lt[1])
    return { lo: 0, hi: hi * 2.0, refLo: 0, refHi: hi }
  }
  const gt = refStr.match(/^>\s*([\d.]+)$/)
  if (gt) {
    const lo = parseFloat(gt[1])
    return { lo: lo * 0.35, hi: lo * 2.0, refLo: lo, refHi: lo * 2.0 }
  }
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

interface RangeBarProps {
  result: BloodTestResult
  bioStat?: BiomarkerStatus
}

export function RangeBar({ result, bioStat }: RangeBarProps) {
  const numericValue =
    typeof bioStat?.value === 'number'
      ? bioStat.value
      : parseFloat(result.value)

  // Qualitative — simple coloured pill.
  if (isNaN(numericValue)) {
    const tier: BiomarkerTier = bioStat?.tier ?? 'unknown'
    const color =
      tier === 'optimal' || tier === 'normal' ? C_GOOD
      : tier === 'watch'                       ? C_WATCH
      : tier === 'out_of_range' || tier === 'critical' ? C_BAD
      : C_NEUTRAL
    return (
      <div className="flex items-center gap-2 py-0.5">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[12px] text-ink">{result.value || '—'}</span>
        {result.unit && <span className="text-[11px] text-ink-2">{result.unit}</span>}
      </div>
    )
  }

  const direction: Direction = bioStat?.direction ?? 'two_sided'
  const refRange = bioStat?.refRange ?? null
  const optRange = bioStat?.optRange ?? null

  // ── Resolve track bounds & zones ─────────────────────────────────────────
  let trackLo: number, trackHi: number, zones: Zone[]

  // Scale-mismatch guard: catches unit mismatches where the stored value is on a very
  // different scale than the registry (e.g. old ×10⁹/L Platelet data vs new lakhs/cumm
  // registry, or vice versa). Falls back to the lab's own refRange string.
  const maxRegistryBound = Math.max(
    refRange?.high ?? 0, refRange?.low ?? 0,
    optRange?.high ?? 0, optRange?.low ?? 0,
  )
  const minRegistryBound = Math.min(
    ...[refRange?.low, optRange?.low].filter((v): v is number => v !== undefined),
  )
  const scaleMismatch =
    (refRange || optRange) &&
    maxRegistryBound > 0 &&
    (Math.abs(numericValue) > maxRegistryBound * 50 ||
     (numericValue > 0 && isFinite(minRegistryBound) && numericValue < minRegistryBound / 50))

  if ((refRange || optRange) && !scaleMismatch) {
    const track = computeTrack(numericValue, refRange, optRange, direction)
    trackLo = track.lo
    trackHi = track.hi
    const labels = getLabels(bioStat?.name ?? '', direction)
    zones = buildZones(direction, refRange, optRange, trackLo, trackHi, labels)
  } else {
    // Fallback: parse the lab's own refRange string for zone boundaries.
    const fb = parseLegacy(result.refRange)
    if (!fb) return null
    trackLo = fb.lo
    trackHi = fb.hi
    zones = [
      { lo: trackLo,  hi: fb.refLo,  color: C_BAD,  label: 'too low' },
      { lo: fb.refLo, hi: fb.refHi,  color: C_GOOD, label: 'normal'  },
      { lo: fb.refHi, hi: trackHi,   color: C_BAD,  label: 'high'    },
    ].filter(z => z.hi > z.lo)
  }
  if (!zones.length) return null

  const trackSpan = trackHi - trackLo
  if (trackSpan <= 0) return null

  const valPct = pctOf(numericValue, trackLo, trackHi)

  const BAR_H = 10
  const TICK_OVERSHOOT = 3  // px the tick extends above and below the bar

  return (
    <div className="relative select-none" style={{ paddingBottom: 34 }}>

      {/* ── Bar + tick ─────────────────────────────────────────────────────── */}
      <div className="relative" style={{ height: BAR_H }}>

        {/* Coloured zone segments with pill-shaped ends */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ borderRadius: BAR_H / 2 }}
        >
          {zones.map((zone, i) => {
            const left  = pctOf(zone.lo, trackLo, trackHi)
            const right = pctOf(zone.hi, trackLo, trackHi)
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0"
                style={{ left: `${left}%`, width: `${right - left}%`, background: zone.color }}
              />
            )
          })}
        </div>

        {/* Tick mark — outside overflow-hidden so it can extend above/below */}
        <div
          className="absolute pointer-events-none"
          style={{
            top:    -TICK_OVERSHOOT,
            height: BAR_H + TICK_OVERSHOOT * 2,
            left:   `${valPct}%`,
            transform: 'translateX(-1px)',
            width:  2,
            background: 'rgba(255,255,255,0.95)',
            borderRadius: 1,
            boxShadow: '0 0 0 0.5px rgba(44,42,30,0.22)',
            zIndex: 10,
          }}
        />
      </div>

      {/* ── Labels ─────────────────────────────────────────────────────────── */}
      <div className="absolute inset-x-0" style={{ top: BAR_H + 5 }}>

        {/* Track min */}
        <span
          className="absolute left-0 text-[9px] leading-none"
          style={{ color: C_NEUTRAL }}
        >
          {fmt(trackLo)}
        </span>

        {/* Zone labels centered in each zone (skip edges and very narrow zones) */}
        {zones.map((zone, i) => {
          if (!zone.label) return null
          const lo       = pctOf(zone.lo, trackLo, trackHi)
          const hi       = pctOf(zone.hi, trackLo, trackHi)
          const widthPct = hi - lo
          const centerPct = (lo + hi) / 2
          if (widthPct < 9)            return null  // too narrow to label
          if (centerPct < 7 || centerPct > 93) return null  // too close to edge labels
          return (
            <span
              key={i}
              className="absolute text-[9px] leading-none whitespace-nowrap"
              style={{
                left:      `${centerPct}%`,
                transform: 'translateX(-50%)',
                color:     C_NEUTRAL,
              }}
            >
              {zone.label}
            </span>
          )
        })}

        {/* Track max */}
        <span
          className="absolute right-0 text-[9px] leading-none"
          style={{ color: C_NEUTRAL }}
        >
          {fmt(trackHi)}
        </span>
      </div>

      {/* ── Ref-range boundary values (second row) ───────────────────────── */}
      {/* Shows the numeric lo value of each zone transition under the bar. */}
      <div className="absolute inset-x-0" style={{ top: BAR_H + 16 }}>
        {zones.slice(1).map((zone, i) => {
          const xPct = pctOf(zone.lo, trackLo, trackHi)
          if (xPct < 6 || xPct > 94) return null
          return (
            <span
              key={i}
              className="absolute text-[9px] leading-none"
              style={{ left: `${xPct}%`, transform: 'translateX(-50%)', color: C_NEUTRAL }}
            >
              {fmt(zone.lo)}
            </span>
          )
        })}
      </div>
    </div>
  )
}
