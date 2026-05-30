'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface SparkPoint { date: string; value: number }

export function TrendSparkline({
  data,
  goodDirection = 'up',
}: {
  data: SparkPoint[]
  goodDirection?: 'up' | 'down'
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

  // Color encodes goodness, not direction
  const isGood = goodDirection === 'up' ? rising : !rising
  const lineColor = isGood ? '#5A7A50' : '#B8842A'

  return (
    <div style={{ width: 72, height: 28 }}>
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
  )
}
