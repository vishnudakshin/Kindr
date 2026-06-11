import type { BloodTestResult } from '@/lib/types'
import type { BiomarkerStatus, BiomarkerTier } from '@/lib/lab-interpretation'
import type { NumericRange, Direction } from '@/lib/lab-config'

// ── Colours ───────────────────────────────────────────────────────────────────

const SAGE    = '#5A7A50'
const BRICK   = '#A63030'
const NEUTRAL = '#9A9478'
const TRACK   = '#D8D0A8'

function tierToColor(tier: BiomarkerTier): string {
  if (tier === 'optimal' || tier === 'normal') return SAGE
  if (tier === 'unknown') return NEUTRAL
  return BRICK  // watch | out_of_range | critical
}

const LEGACY_COLOR: Record<NonNullable<BloodTestResult['status']>, string> = {
  normal: SAGE, borderline: BRICK, abnormal: BRICK,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1000) return String(Math.round(n))
  if (n % 1 === 0) return String(n)
  // 1 decimal for small floats, 2 for very small
  return n < 1 ? n.toFixed(2) : n.toFixed(1)
}

function pct(v: number, lo: number, hi: number): number {
  return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))
}

// Compute a sensible track window that includes value + all range bounds.
function trackBounds(
  value: number,
  ref: NumericRange | null,
  opt: NumericRange | null,
  direction: Direction,
): { lo: number; hi: number } | null {
  const pts = [value, ref?.low, ref?.high, opt?.low, opt?.high]
    .filter((v): v is number => v != null)
  if (pts.length === 0) return null

  const dMin = Math.min(...pts)
  const dMax = Math.max(...pts)
  const span = Math.max(dMax - dMin, 1)

  // One-sided markers start at 0; two-sided add padding below the data min.
  const rawLo = (direction === 'high_bad' || direction === 'low_bad')
    ? 0
    : Math.max(0, dMin - span * 0.25)

  return {
    lo: Math.floor(rawLo),
    hi: Math.ceil(dMax + span * 0.2),
  }
}

// Fall-back: parse a refRange string the same way the old component did.
function parseRefString(ref: string): { lo: number; hi: number; sageLo: number; sageHi: number } | null {
  const between = ref.match(/^([\d.]+)[–\-]([\d.]+)$/)
  if (between) {
    const lo = parseFloat(between[1]), hi = parseFloat(between[2])
    const span = hi - lo
    return { lo: Math.max(0, lo - span * 0.4), hi: hi + span * 0.4, sageLo: lo, sageHi: hi }
  }
  const lt = ref.match(/^<\s*([\d.]+)$/)
  if (lt) {
    const hi = parseFloat(lt[1])
    return { lo: 0, hi: hi * 2.2, sageLo: 0, sageHi: hi }
  }
  const gt = ref.match(/^>\s*([\d.]+)$/)
  if (gt) {
    const lo = parseFloat(gt[1])
    return { lo: lo * 0.4, hi: lo * 2.2, sageLo: lo, sageHi: lo * 2.2 }
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

  const dotColor = bioStat
    ? tierToColor(bioStat.tier)
    : result.status
    ? LEGACY_COLOR[result.status]
    : NEUTRAL

  // Qualitative or unparseable — simple coloured pill display.
  if (isNaN(numericValue)) {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
        <span className="text-[12px] text-ink">{result.value || '—'}</span>
        {result.unit && <span className="text-[11px] text-ink-2">{result.unit}</span>}
      </div>
    )
  }

  // ── Resolve track + sage-band bounds ────────────────────────────────────────
  const ref = bioStat?.refRange ?? null
  const direction: Direction = bioStat?.direction ?? 'two_sided'

  let trackLo: number, trackHi: number
  let sageLo: number | null = null
  let sageHi: number | null = null
  const showOptLabel = false

  if (ref) {
    const bounds = trackBounds(numericValue, ref, null, direction)
    if (!bounds) return null
    trackLo = bounds.lo
    trackHi = bounds.hi
    sageLo = ref.low ?? trackLo
    sageHi = ref.high ?? trackHi
  } else {
    // Fall back to string parsing.
    const fb = parseRefString(result.refRange)
    if (!fb) return null
    trackLo = fb.lo
    trackHi = fb.hi
    sageLo = fb.sageLo
    sageHi = fb.sageHi
  }

  const trackSpan = trackHi - trackLo
  if (trackSpan <= 0) return null

  const valPct = pct(numericValue, trackLo, trackHi)

  // Sage band dimensions as % of track width.
  let sageLeft = 0, sageWidth = 0, sageCenterPct = 50
  if (sageLo !== null && sageHi !== null) {
    sageLeft  = pct(sageLo, trackLo, trackHi)
    sageWidth = Math.max(0, pct(sageHi, trackLo, trackHi) - sageLeft)
    sageCenterPct = sageLeft + sageWidth / 2
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="relative" style={{ paddingBottom: 18 }}>
      {/* Track + dot row */}
      <div className="relative" style={{ height: 12 }}>
        {/* Neutral hairline */}
        <div
          className="absolute inset-x-0"
          style={{ top: 5, height: 1.5, borderRadius: 2, background: TRACK }}
        />
        {/* Sage optimal band */}
        {sageWidth > 0 && (
          <div
            className="absolute"
            style={{
              top: 5, height: 1.5, borderRadius: 2,
              left: `${sageLeft}%`, width: `${sageWidth}%`,
              background: SAGE,
            }}
          />
        )}
        {/* Value dot */}
        <div
          className="absolute"
          style={{
            top: 1,
            left: `calc(${valPct}% - 5px)`,
            width: 10, height: 10, borderRadius: '50%',
            background: dotColor,
            boxShadow: `0 0 0 2px #F5F0D0, 0 1px 4px rgba(0,0,0,0.14)`,
          }}
        />
      </div>

      {/* Range labels */}
      <div className="absolute inset-x-0" style={{ bottom: 0 }}>
        <span className="absolute left-0 text-[9px] leading-none" style={{ color: NEUTRAL }}>
          {fmt(trackLo)}
        </span>
        {showOptLabel && sageWidth > 0 && (
          <span
            className="absolute text-[9px] leading-none whitespace-nowrap"
            style={{
              left: `${sageCenterPct}%`,
              transform: 'translateX(-50%)',
              color: SAGE,
            }}
          >
            Optimal level
          </span>
        )}
        <span className="absolute right-0 text-[9px] leading-none" style={{ color: NEUTRAL }}>
          {fmt(trackHi)}
        </span>
      </div>
    </div>
  )
}
