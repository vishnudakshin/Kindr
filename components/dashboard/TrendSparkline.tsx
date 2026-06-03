'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface SparkPoint { date: string; value: number }

export function TrendSparkline({
  data,
  goodDirection = 'up',
  showDelta = false,
}: {
  data: SparkPoint[]
  goodDirection?: 'up' | 'down'
  showDelta?: boolean
}) {
  if (data.length < 2) {
    return (
      <p className="text-[10px] text-ink-2 italic leading-tight">
        First reading — trend appears after your next test.
      </p>
    )
  }

  const first = data[0].value
  const last  = data[data.length - 1].value
  const rising = last > first
  const delta  = last - first

  const isGood     = goodDirection === 'up' ? rising : !rising
  const lineColor  = isGood ? '#5A7A50' : '#B8842A'
  const absDelta   = Math.abs(delta)
  const deltaStr   = absDelta >= 10 ? Math.round(absDelta).toString() : absDelta.toFixed(1)

  return (
    <div className="flex items-center gap-1.5">
      <div style={{ width: 60, height: 24 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {showDelta && delta !== 0 && (
        <span className="text-[10px] font-medium tabular-nums" style={{ color: lineColor }}>
          {rising ? '↑' : '↓'} {deltaStr}
        </span>
      )}
    </div>
  )
}
