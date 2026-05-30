import type { BloodTestResult } from '@/lib/types'

type Parsed = { trackMin: number; trackMax: number; optMin: number; optMax: number }

function parseRef(ref: string): Parsed | null {
  const between = ref.match(/^([\d.]+)[–\-]([\d.]+)$/)
  if (between) {
    const lo = parseFloat(between[1]), hi = parseFloat(between[2])
    const span = hi - lo
    return { trackMin: Math.max(0, lo - span * 0.4), trackMax: hi + span * 0.4, optMin: lo, optMax: hi }
  }
  const lt = ref.match(/^<\s*([\d.]+)$/)
  if (lt) {
    const hi = parseFloat(lt[1])
    return { trackMin: 0, trackMax: hi * 2.2, optMin: 0, optMax: hi }
  }
  const gt = ref.match(/^>\s*([\d.]+)$/)
  if (gt) {
    const lo = parseFloat(gt[1])
    return { trackMin: lo * 0.4, trackMax: lo * 2.2, optMin: lo, optMax: lo * 2.2 }
  }
  return null
}

const DOT_COLOR: Record<NonNullable<BloodTestResult['status']>, string> = {
  normal:     '#5A7A50',
  borderline: '#B8842A',
  abnormal:   '#A63030',
}

export function RangeBar({ result }: { result: BloodTestResult }) {
  const numeric = parseFloat(result.value)
  const parsed = parseRef(result.refRange)
  const dotColor = result.status ? DOT_COLOR[result.status] : '#6B6650'

  if (isNaN(numeric) || !parsed) {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
        <span className="text-[12px] text-ink">{result.value || '—'}</span>
        <span className="text-[11px] text-ink-2">{result.unit}</span>
      </div>
    )
  }

  const { trackMin, trackMax, optMin, optMax } = parsed
  const span = trackMax - trackMin
  const valPct  = Math.max(0, Math.min(1, (numeric - trackMin) / span)) * 100
  const optL    = Math.max(0, Math.min(100, (optMin - trackMin) / span * 100))
  const optW    = Math.max(0, Math.min(100 - optL, (optMax - optMin) / span * 100))

  return (
    <div className="relative h-4 w-full">
      {/* Track */}
      <div className="absolute top-[6px] inset-x-0 h-2 rounded-full bg-border/50" />
      {/* Optimal zone */}
      <div
        className="absolute top-[6px] h-2 rounded-full bg-accent/70"
        style={{ left: `${optL}%`, width: `${optW}%` }}
      />
      {/* Value dot */}
      <div
        className="absolute top-[3px] w-[10px] h-[10px] rounded-full border-[1.5px] border-card shadow-sm"
        style={{ left: `calc(${valPct}% - 5px)`, background: dotColor }}
      />
    </div>
  )
}
