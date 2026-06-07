import { mockData, bodySystems, STATUS_META } from '@/lib/data'

// ── Dimension display labels ───────────────────────────────────────────────────
const DIM_LABEL: Record<string, string> = {
  stress:    'Stress management',
  activity:  'Physical activity',
  sleep:     'Sleep quality',
  nutrition: 'Nutrition',
  cognition: 'Cognitive health',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// Concise human-readable insight per lab system
const LAB_INSIGHT: Record<string, string> = {
  blood:     'Mild inflammation — CRP and ferritin are mildly elevated',
  liver:     'Fatty liver index is marginally above optimal',
  vitamins:  'Vitamin D is below the recommended range',
  heart:     'Non-HDL cholesterol and TG/HDL ratio need monitoring',
  metabolic: 'Early insulin-resistance signal — HOMA-IR is elevated',
  kidney:    'Kidney markers need continued monitoring',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WellnessReport() {
  const { currentScores } = mockData
  const overall = currentScores.overall

  // Three lowest-scoring lifestyle dimensions (exclude overall and wellbeing cross-check)
  const weakDims = (Object.entries(currentScores) as [string, number][])
    .filter(([k]) => k !== 'overall' && k !== 'wellbeing')
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)

  // Lab systems that are not optimal, ordered by deficient count desc
  const labIssues = bodySystems
    .filter(s => s.status !== 'optimal')
    .sort((a, b) => b.deficientCount - a.deficientCount)

  const overallColor = scoreColor(overall)

  return (
    <div className="mb-10">
      {/* Section header */}
      <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1">
        Wellness report
      </p>
      <h2 className="font-serif text-[26px] font-medium text-ink leading-snug">
        Your wellness report.
      </h2>
      <p className="text-[14px] text-ink-2 mt-1 mb-5 leading-relaxed">
        A snapshot of your health based on your latest assessment and lab results.
      </p>

      {/* Report card */}
      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">

        {/* ── Overall score ── */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] tracking-[.06em] uppercase font-medium text-ink-2">
              Overall wellness
            </p>
            <span
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: overallColor + '1A',
                color: overallColor,
              }}
            >
              {scoreLabel(overall)}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="font-serif text-[40px] font-medium text-ink leading-none">
              {overall}
            </span>
            <span className="text-[15px] text-ink-2">/&nbsp;100</span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${overall}%`, background: overallColor }}
            />
          </div>
        </div>

        {/* ── Lifestyle highlights ── */}
        <div className="px-5 py-4 border-b border-border">
          <p className="text-[11px] tracking-[.06em] uppercase font-medium text-ink-2 mb-3">
            Lifestyle
          </p>
          <div className="flex flex-col gap-3">
            {weakDims.map(([key, score]) => {
              const clr = scoreColor(score)
              return (
                <div key={key} className="flex items-center gap-3">
                  <div
                    className="w-[5px] h-[5px] rounded-full shrink-0"
                    style={{ background: clr }}
                  />
                  <span className="flex-1 text-[13px] text-ink leading-none">
                    {DIM_LABEL[key]}
                  </span>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="w-16 h-[3px] rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${score}%`, background: clr }}
                      />
                    </div>
                    <span
                      className="text-[11px] w-5 text-right tabular-nums font-medium"
                      style={{ color: clr }}
                    >
                      {score}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Lab findings ── */}
        <div className="px-5 py-4">
          <p className="text-[11px] tracking-[.06em] uppercase font-medium text-ink-2 mb-3">
            Lab findings
          </p>
          {labIssues.length === 0 ? (
            <p className="text-[13px] text-ink-2">All markers are within optimal range.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {labIssues.map(sys => {
                const insight = LAB_INSIGHT[sys.id]
                if (!insight) return null
                return (
                  <div key={sys.id} className="flex items-start gap-2.5">
                    <div
                      className="w-[5px] h-[5px] rounded-full shrink-0 mt-[5px]"
                      style={{ background: STATUS_META[sys.status].color }}
                    />
                    <p className="text-[13px] text-ink leading-snug">{insight}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
