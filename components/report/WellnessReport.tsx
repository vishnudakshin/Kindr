import { mockData, bodySystems, STATUS_META } from '@/lib/data'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIM_LABEL: Record<string, string> = {
  stress:    'Stress management',
  activity:  'Physical activity',
  sleep:     'Sleep quality',
  nutrition: 'Nutrition',
  cognition: 'Cognitive health',
}

function scoreColor(n: number) {
  if (n < 40) return '#A83028'
  if (n < 60) return '#C77D2E'
  return '#2E7D32'
}

function scoreLabel(n: number) {
  if (n < 40) return 'Action needed'
  if (n < 60) return 'Developing'
  if (n < 75) return 'Good'
  return 'Strong'
}

const LAB_INSIGHT: Record<string, string> = {
  blood:     'Mild inflammation — CRP and ferritin are mildly elevated',
  liver:     'Fatty liver index is marginally above optimal',
  vitamins:  'Vitamin D is below the recommended range',
  heart:     'Non-HDL cholesterol and TG/HDL ratio need monitoring',
  metabolic: 'Early insulin-resistance signal — HOMA-IR is elevated',
}

// ── Improvement areas (derived from questionnaire + blood panel) ───────────────

interface ImprovementArea {
  id:     string
  label:  string
  color:  string
  bg:     string
  points: string[]
}

function buildImprovements(): ImprovementArea[] {
  const { questionnaire } = mockData
  const { nutrition, activity, sleep } = questionnaire

  return [
    {
      id:    'diet',
      label: 'Diet',
      color: '#4A7A32',
      bg:    '#E6F2DE',
      points: [
        nutrition.processed <= 2
          ? 'Reduce ultra-processed and packaged foods to twice a week or fewer'
          : 'You\'re doing well with processed food — maintain this habit',
        nutrition.fruitVeg < 4
          ? 'Aim for 5 portions of fruit and vegetables daily — add one extra serving per meal'
          : 'Great fruit and vegetable intake — keep it consistent',
        'Choose low-glycaemic foods at meals to support metabolic health and reduce insulin spikes',
        'Increase dietary iron through lean red meat, lentils, and dark leafy greens to support ferritin levels',
      ].slice(0, 3),
    },
    {
      id:    'lifestyle',
      label: 'Lifestyle',
      color: '#5A4880',
      bg:    '#E8E4F0',
      points: [
        sleep.duration <= 4
          ? 'Aim for 7–9 hours of sleep — establish a consistent sleep and wake time, even on weekends'
          : 'Sleep duration looks reasonable — focus on improving sleep quality and restedness',
        activity.sitting >= 6
          ? 'Break up prolonged sitting — aim to move for at least 5 minutes every hour'
          : 'Good job limiting sedentary time — keep active throughout the day',
        'Introduce a 5-minute breathing or mindfulness practice to manage stress and support afternoon energy',
      ],
    },
    {
      id:    'activity',
      label: 'Physical activity',
      color: '#2A5A80',
      bg:    '#DDE9F5',
      points: [
        activity.vigorous < 3
          ? 'Add 1–2 more vigorous sessions weekly — cycling, running, or interval training'
          : 'Good vigorous activity — consider adding variety to avoid adaptation',
        activity.sitting >= 6
          ? 'Aim for 8,000–10,000 steps daily to offset high sedentary time'
          : 'Keep up your daily movement habit',
        'Incorporate resistance training 2× per week — it supports metabolic health, bone density, and body composition',
      ],
    },
    {
      id:    'supplements',
      label: 'Supplements',
      color: '#8A5A20',
      bg:    '#F2EAD8',
      points: [
        'Vitamin D3 (1,000–2,000 IU/day) — your level is below the optimal range and supports immunity, mood, and bone health',
        'Ferritin support — consider a chelated iron supplement or increase dietary sources; check levels in 3 months',
        'Omega-3 fatty acids (1–2 g EPA+DHA/day) to address mild inflammation and support cardiovascular markers',
      ],
    },
  ]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WellnessReport() {
  const { currentScores } = mockData
  const overall = currentScores.overall
  const overallColor = scoreColor(overall)

  // All 5 dimensions, sorted weakest first
  const weakDims = (Object.entries(currentScores) as [string, number][])
    .filter(([k]) => k !== 'overall')
    .sort(([, a], [, b]) => a - b)

  const labIssues = bodySystems
    .filter(s => s.status !== 'optimal')
    .sort((a, b) => b.deficientCount - a.deficientCount)

  const improvements = buildImprovements()

  return (
    <div className="flex flex-col gap-5">

      {/* ── Card 1: Health snapshot ── */}
      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">

        {/* Overall score */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] tracking-[.06em] uppercase font-medium text-ink-2">
              Overall wellness
            </p>
            <span
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: overallColor + '1A', color: overallColor }}
            >
              {scoreLabel(overall)}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="font-serif text-[42px] font-medium text-ink leading-none">{overall}</span>
            <span className="text-[15px] text-ink-2">/ 100</span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${overall}%`, background: overallColor }}
            />
          </div>
        </div>

        {/* Lifestyle scores */}
        <div className="px-5 py-4 border-b border-border">
          <p className="text-[11px] tracking-[.06em] uppercase font-medium text-ink-2 mb-3">
            Lifestyle
          </p>
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
                    <span className="text-[11px] w-5 text-right tabular-nums font-medium" style={{ color: clr }}>
                      {score}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Lab findings */}
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

      {/* ── Card 2: Areas of improvement ── */}
      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="px-5 pt-5 pb-1">
          <p className="text-[11px] tracking-[.06em] uppercase font-medium text-ink-2 mb-0.5">
            Areas of improvement
          </p>
          <p className="text-[13px] text-ink-2 mb-4 leading-relaxed">
            Personalised actions based on your scores and lab results.
          </p>
        </div>

        {improvements.map((area, i) => (
          <div
            key={area.id}
            className={`px-5 py-4 ${i < improvements.length - 1 ? 'border-b border-border' : 'pb-5'}`}
          >
            <span
              className="inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full mb-3"
              style={{ background: area.bg, color: area.color }}
            >
              {area.label}
            </span>
            <div className="flex flex-col gap-2">
              {area.points.map((pt, j) => (
                <div key={j} className="flex items-start gap-2.5">
                  <div
                    className="w-[5px] h-[5px] rounded-full shrink-0 mt-[5px]"
                    style={{ background: area.color }}
                  />
                  <p className="text-[13px] text-ink leading-relaxed">{pt}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
