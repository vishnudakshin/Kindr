'use client'

import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import type { WellnessScores } from '@/lib/types'

export function WellnessRadar({ scores }: { scores: WellnessScores }) {
  const data = [
    { dim: 'Nutrition',  value: scores.nutrition  },
    { dim: 'Sleep',      value: scores.sleep      },
    { dim: 'Activity',   value: scores.activity   },
    { dim: 'Cognition',  value: scores.cognition  },
    { dim: 'Stress',     value: scores.stress     },
    { dim: 'Wellbeing',  value: scores.wellbeing  },
  ]

  const overall = scores.overall
  const grade =
    overall >= 75 ? 'Great' :
    overall >= 50 ? 'Good' :
    overall >= 30 ? 'Fair' : 'Needs attention'

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-[13px] text-ink-2"></p>
        <div className="flex items-baseline gap-1.5">
          <span className="font-serif text-[28px] font-medium text-ink leading-none">{overall}</span>
          <span className="text-[11px] text-ink-2">/100 · {grade}</span>
        </div>
      </div>

      <div className="w-full" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 8, right: 28, bottom: 8, left: 28 }}>
            <PolarGrid stroke="#D8D0A8" strokeWidth={0.8} />
            <PolarAngleAxis
              dataKey="dim"
              tick={{ fontSize: 11, fill: '#6B6650', fontFamily: 'inherit' }}
              tickLine={false}
            />
            <Radar
              dataKey="value"
              stroke="#2C2A1E"
              fill="#E8E0A0"
              fillOpacity={0.55}
              strokeWidth={1.5}
            />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null
                const { dim, value } = payload[0].payload as { dim: string; value: number }
                return (
                  <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-card">
                    <p className="text-[11px] text-ink-2">{dim}</p>
                    <p className="font-serif text-[18px] text-ink font-medium">{value}</p>
                  </div>
                )
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
