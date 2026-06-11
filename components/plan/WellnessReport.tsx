import { mockData, findings } from '@/lib/data'
import type { Finding } from '@/lib/data'
import type { Pillar } from '@/lib/findings-config'

// ── Design tokens ─────────────────────────────────────────────────────────────

const PILLAR_STYLE: Record<Pillar, { bg: string; text: string; dot: string }> = {
  Nourish:  { bg: '#E6F2DE', text: '#4A7A32', dot: '#4A7A32' },
  Move:     { bg: '#DDE9F5', text: '#2A5A80', dot: '#2A5A80' },
  Calm:     { bg: '#E8E4F0', text: '#5A4880', dot: '#5A4880' },
  Clinical: { bg: '#FEF2F2', text: '#A63030', dot: '#A63030' },
}

function scoreColor(n: number): string {
  if (n < 40) return '#A83028'
  if (n < 60) return '#C77D2E'
  return '#2E7D32'
}
function scoreLabel(n: number): string {
  if (n < 40) return 'Action needed'
  if (n < 60) return 'Developing'
  if (n < 75) return 'Good'
  return 'Strong'
}

const DIM_LABEL: Record<string, string> = {
  stress:    'Stress management',
  activity:  'Physical activity',
  sleep:     'Sleep quality',
  nutrition: 'Nutrition',
  cognition: 'Cognitive health',
}

// ── Compact finding row ───────────────────────────────────────────────────────

function FindingRow({ f, primaryPillar }: { f: Finding; primaryPillar: Pillar }) {
  const style = PILLAR_STYLE[primaryPillar]
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0 mt-[5px]"
        style={{ background: style.dot }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[13px] font-medium text-ink leading-snug">{f.title}</p>
          {f.refer && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0" style={{ background: '#FEF2F2', color: '#A63030' }}>
              See clinician
            </span>
          )}
        </div>
        <p className="text-[12px] text-ink-2 leading-relaxed">{f.detail}</p>
      </div>
    </div>
  )
}

// Group findings by their primary pillar (first pillar in the list)
function groupByPillar(findings: Finding[]): Map<Pillar, Finding[]> {
  const order: Pillar[] = ['Nourish', 'Move', 'Calm', 'Clinical']
  const map = new Map<Pillar, Finding[]>(order.map(p => [p, []]))
  for (const f of findings) {
    const primary = f.pillars[0] as Pillar
    if (primary && map.has(primary)) map.get(primary)!.push(f)
  }
  return map
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WellnessReport() {
  const { currentScores } = mockData
  const overall = currentScores.overall
  const overallColor = scoreColor(overall)

  const weakDims = (Object.entries(currentScores) as [string, number][])
    .filter(([k]) => k !== 'overall' && k !== 'wellbeing')
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)

  const { findings: concerns, strengths, hasReferral } = findings

  // Top-priority concerns only (cap at 8 to keep plan focused)
  const topConcerns = concerns.slice(0, 8)
  const byPillar = groupByPillar(topConcerns)

  return (
    <div className="mb-8">
      <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1">Wellness report</p>
      <h2 className="font-serif text-[26px] font-medium text-ink leading-snug">Your health snapshot.</h2>
      <p className="text-[14px] text-ink-2 mt-1 mb-5 leading-relaxed">
        Priority areas drawn from your questionnaire and labs.
      </p>

      {/* Overall + lifestyle */}
      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden mb-4">

        <div className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] tracking-[.06em] uppercase font-medium text-ink-2">Overall wellness</p>
            <span
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: overallColor + '1A', color: overallColor }}
            >
              {scoreLabel(overall)}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="font-serif text-[40px] font-medium text-ink leading-none">{overall}</span>
            <span className="text-[15px] text-ink-2">/&nbsp;100</span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${overall}%`, background: overallColor }} />
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="text-[11px] tracking-[.06em] uppercase font-medium text-ink-2 mb-3">Top priorities</p>
          <div className="flex flex-col gap-3">
            {weakDims.map(([key, score]) => {
              const clr = scoreColor(score)
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: clr }} />
                  <span className="flex-1 text-[13px] text-ink">{DIM_LABEL[key]}</span>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="w-16 h-[3px] rounded-full bg-border overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${score}%`, background: clr }} />
                    </div>
                    <span className="text-[11px] w-5 text-right tabular-nums font-medium" style={{ color: clr }}>{score}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Referral banner */}
      {hasReferral && (
        <div className="rounded-2xl border px-4 py-3 mb-4 flex items-center gap-2.5" style={{ background: '#FEF2F2', borderColor: '#A6303033' }}>
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#A63030' }} />
          <p className="text-[12px] leading-snug" style={{ color: '#A63030' }}>
            Some findings below are flagged for clinical review.
          </p>
        </div>
      )}

      {/* Pillar-grouped findings */}
      {(['Nourish', 'Move', 'Calm', 'Clinical'] as Pillar[]).map(pillar => {
        const list = byPillar.get(pillar) ?? []
        if (list.length === 0) return null
        const style = PILLAR_STYLE[pillar]
        return (
          <div key={pillar} className="bg-card rounded-2xl border border-border shadow-card overflow-hidden mb-3">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <span
                className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: style.bg, color: style.text }}
              >
                {pillar}
              </span>
              <span className="text-[11px] text-ink-2">{list.length} finding{list.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="px-5">
              {list.map(f => (
                <FindingRow key={f.id} f={f} primaryPillar={pillar} />
              ))}
            </div>
          </div>
        )
      })}

      {/* Strengths summary */}
      {strengths.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-card px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: '#2E7D32' }} />
            <p className="text-[11px] tracking-[.06em] uppercase font-medium text-ink-2">What is going well</p>
          </div>
          <div className="flex flex-col gap-1 mt-2">
            {strengths.map(f => (
              <p key={f.id} className="text-[12px] text-ink-2 leading-snug">· {f.title}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
