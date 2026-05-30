import { BrandHeader } from '@/components/ui/BrandHeader'
import { mockData } from '@/lib/data'
import type { GoalId } from '@/lib/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<GoalId, string> = {
  energy:     'More energy',
  mood:       'Better mood',
  clarity:    'Mental clarity',
  sleep:      'Better sleep',
  nutrition:  'Eat well',
  fitness:    'Get active',
  prevention: 'Prevention',
  wellbeing:  'Overall wellbeing',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

const DIM_LABELS: { key: keyof typeof mockData.currentScores; label: string }[] = [
  { key: 'nutrition', label: 'Nutrition'  },
  { key: 'sleep',     label: 'Sleep'      },
  { key: 'activity',  label: 'Activity'   },
  { key: 'cognition', label: 'Cognition'  },
  { key: 'stress',    label: 'Stress'     },
]

function ScoreBar({ value }: { value: number }) {
  const color =
    value >= 75 ? '#5A7A50' :
    value >= 50 ? '#2C2A1E' :
    '#B8842A'

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-[12px] font-medium text-ink w-7 text-right">{value}</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, currentScores } = mockData

  const initials = user.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()

  const overall = currentScores.overall
  const grade =
    overall >= 75 ? 'Great'  :
    overall >= 50 ? 'Good'   :
    overall >= 30 ? 'Fair'   : 'Needs attention'

  return (
    <>
      <BrandHeader />
      <div className="px-6 pt-4 pb-10 flex flex-col gap-6">

        {/* Avatar + name */}
        <div className="flex items-center gap-4 pt-2">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center shrink-0">
            <span className="font-serif text-[22px] font-medium text-ink">{initials}</span>
          </div>
          <div>
            <h1 className="font-serif text-[26px] font-medium text-ink leading-tight">
              {user.name}
            </h1>
            <p className="text-[12px] text-ink-2 mt-0.5">Member since {fmtDate(user.dateJoined)}</p>
          </div>
        </div>

        {/* Overall score card */}
        <div className="bg-card rounded-2xl border border-border shadow-card p-5">
          <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-3">Current score</p>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="font-serif text-[48px] font-medium text-ink leading-none">{overall}</span>
            <span className="text-[15px] text-ink-2">/100 · {grade}</span>
          </div>

          {/* Per-dimension bars */}
          <div className="flex flex-col gap-2.5">
            {DIM_LABELS.map(({ key, label }) => (
              <div key={key}>
                <p className="text-[11px] text-ink-2 mb-1">{label}</p>
                <ScoreBar value={currentScores[key]} />
              </div>
            ))}
          </div>
        </div>

        {/* Goals */}
        <div className="bg-card rounded-2xl border border-border shadow-card p-5">
          <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-3">Your goals</p>
          <div className="flex flex-wrap gap-2">
            {user.goals.map(g => (
              <span
                key={g}
                className="px-3 py-1.5 rounded-full bg-accent text-ink text-[12px] font-medium"
              >
                {GOAL_LABELS[g]}
              </span>
            ))}
          </div>
        </div>

        {/* Reassessment date */}
        <div className="bg-card rounded-2xl border border-border shadow-card p-5">
          <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1">Next reassessment</p>
          <p className="font-serif text-[18px] font-medium text-ink mt-1">
            {fmtDate(user.reassessmentDate)}
          </p>
          <p className="text-[12px] text-ink-2 mt-1 leading-relaxed">
            Retake the questionnaire to track your progress and refresh your plan.
          </p>
        </div>

      </div>
    </>
  )
}
