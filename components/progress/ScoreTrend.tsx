'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { ScoreSnapshot } from '@/lib/types'

const DIMS = [
  { key: 'nutrition', label: 'Nutrition',  color: '#7AB855' },
  { key: 'sleep',     label: 'Sleep',      color: '#7B8FCC' },
  { key: 'activity',  label: 'Activity',   color: '#CC8844' },
  { key: 'cognition', label: 'Cognition',  color: '#A07BC4' },
  { key: 'stress',    label: 'Stress',     color: '#C4746A' },
] as const

function fmtDate(iso: string) {
  const [, m, ] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return months[parseInt(m, 10) - 1] + " '" + iso.slice(2, 4)
}

export function ScoreTrend({ history }: { history: ScoreSnapshot[] }) {
  const data = history.map(s => ({
    date:      fmtDate(s.date),
    overall:   s.scores.overall,
    nutrition: s.scores.nutrition,
    sleep:     s.scores.sleep,
    activity:  s.scores.activity,
    cognition: s.scores.cognition,
    stress:    s.scores.stress,
  }))

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-[13px] font-medium text-ink">Score over time</p>
        <p className="text-[11px] text-ink-2">{history.length} checkpoints</p>
      </div>

      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="#E8E0A8" strokeWidth={0.6} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#6B6650' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#6B6650' }}
              axisLine={false} tickLine={false}
              ticks={[0, 25, 50, 75, 100]}
            />
            <ReferenceLine y={50} stroke="#D8D0A8" strokeDasharray="4 3" strokeWidth={1} />
            <Tooltip
              content={({ payload, label }) => {
                if (!payload?.length) return null
                return (
                  <div className="bg-card border border-border rounded-xl px-3 py-2.5 shadow-card min-w-[140px]">
                    <p className="text-[10px] tracking-wide uppercase text-ink-2 mb-1.5">{label}</p>
                    {payload.map(p => (
                      <div key={p.dataKey} className="flex items-center justify-between gap-3 mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: p.color as string }} />
                          <span className="text-[11px] text-ink-2">{p.name}</span>
                        </div>
                        <span className="text-[11px] font-medium text-ink">{p.value}</span>
                      </div>
                    ))}
                  </div>
                )
              }}
            />
            {/* Overall — prominent */}
            <Line
              dataKey="overall" name="Overall"
              stroke="#2C2A1E" strokeWidth={2.5}
              dot={{ r: 4, fill: '#2C2A1E', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            {/* Per-dimension — lighter */}
            {DIMS.map(d => (
              <Line
                key={d.key} dataKey={d.key} name={d.label}
                stroke={d.color} strokeWidth={1.2}
                dot={{ r: 2.5, fill: d.color, strokeWidth: 0 }}
                strokeDasharray="5 3"
                activeDot={{ r: 4 }}
              />
            ))}
            <Legend
              iconType="circle" iconSize={6}
              wrapperStyle={{ fontSize: 10, color: '#6B6650', paddingTop: 10 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
