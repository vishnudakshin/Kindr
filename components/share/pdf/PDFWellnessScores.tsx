import { View, Text, Svg, Circle, Polygon, Line, G } from '@react-pdf/renderer'
import { PDFPageShell } from './PDFPageShell'
import { S, PALETTE } from './styles'
import type { WellnessScores } from '@/lib/types'

const DIMS = [
  { key: 'nutrition'  as const, label: 'Nutrition'  },
  { key: 'sleep'      as const, label: 'Sleep'      },
  { key: 'activity'   as const, label: 'Activity'   },
  { key: 'cognition'  as const, label: 'Cognition'  },
  { key: 'stress'     as const, label: 'Stress'     },
  { key: 'wellbeing'  as const, label: 'Wellbeing'  },
]

// Radar geometry — 6 axes, centred at (cx, cy)
const CX = 120, CY = 110, R = 88
const angles = DIMS.map((_, i) => (Math.PI * 2 * i) / DIMS.length - Math.PI / 2)

function polar(score: number, angle: number, scale = 1) {
  const r = (score / 100) * R * scale
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) }
}

function radarPoints(scores: WellnessScores): string {
  return angles
    .map((a, i) => {
      const { x, y } = polar(scores[DIMS[i].key], a)
      return `${x},${y}`
    })
    .join(' ')
}

// Grid ring at a given fraction
function ringPoints(frac: number): string {
  return angles
    .map(a => {
      const r = frac * R
      return `${CX + r * Math.cos(a)},${CY + r * Math.sin(a)}`
    })
    .join(' ')
}

interface Props {
  scores: WellnessScores
  prevScores?: WellnessScores
  footerText: string
}

function ScoreBar({ value }: { value: number }) {
  const w = 80
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: w, height: 6, backgroundColor: PALETTE.border, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ width: (value / 100) * w, height: 6, backgroundColor: PALETTE.accent, borderRadius: 3 }} />
      </View>
      <Text style={[S.tableCellMuted, { width: 24, textAlign: 'right' }]}>{value}</Text>
    </View>
  )
}

export function PDFWellnessScores({ scores, prevScores, footerText }: Props) {
  const filledPoints = radarPoints(scores)

  return (
    <PDFPageShell footerText={footerText} pageNumber={2}>
      <Text style={S.sectionHeading}>Wellness Scores</Text>
      <View style={S.sectionRule} />

      {/* Radar chart */}
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <Svg width={240} height={220}>
          {/* Grid rings */}
          {[0.25, 0.5, 0.75, 1].map(frac => (
            <Polygon
              key={frac}
              points={ringPoints(frac)}
              fill="none"
              stroke={frac === 1 ? PALETTE.border : PALETTE.border}
              strokeWidth={frac === 1 ? 1 : 0.5}
              strokeDasharray={frac < 1 ? '3,3' : undefined}
            />
          ))}

          {/* Axis lines */}
          {angles.map((a, i) => {
            const end = polar(100, a)
            return (
              <Line
                key={i}
                x1={CX} y1={CY}
                x2={end.x} y2={end.y}
                stroke={PALETTE.border}
                strokeWidth={0.5}
              />
            )
          })}

          {/* Filled area */}
          <Polygon
            points={filledPoints}
            fill={PALETTE.accent}
            fillOpacity={0.55}
            stroke={PALETTE.ink}
            strokeWidth={1.2}
          />

          {/* Score dots */}
          {angles.map((a, i) => {
            const { x, y } = polar(scores[DIMS[i].key], a)
            return <Circle key={i} cx={x} cy={y} r={3} fill={PALETTE.ink} />
          })}

          {/* Axis labels */}
          {angles.map((a, i) => {
            const { x, y } = polar(115, a)
            return (
              <G key={i}>
                <Text
                  style={{ fontSize: 8, color: PALETTE.ink2 }}
                  // react-pdf SVG Text needs x/y as props
                  // @ts-ignore react-pdf SVG text
                  x={x - 18} y={y + 3}
                >
                  {DIMS[i].label}
                </Text>
              </G>
            )
          })}
        </Svg>
      </View>

      {/* Scores table */}
      <View style={S.table}>
        <View style={S.tableHeader}>
          <Text style={[S.tableHeadCell, { flex: 2 }]}>Dimension</Text>
          <Text style={[S.tableHeadCell, { flex: 1, textAlign: 'center' }]}>Score</Text>
          {prevScores && <Text style={[S.tableHeadCell, { flex: 1, textAlign: 'center' }]}>vs. last</Text>}
          <Text style={[S.tableHeadCell, { flex: 2 }]}>  </Text>
        </View>

        {DIMS.map(({ key, label }, i) => {
          const score = scores[key]
          const prev  = prevScores?.[key]
          const delta = prev !== undefined ? score - prev : undefined
          return (
            <View key={key} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
              <Text style={[S.tableCell, { flex: 2 }]}>{label}</Text>
              <Text style={[S.tableCell, { flex: 1, textAlign: 'center', fontFamily: 'Helvetica-Bold' }]}>
                {score}
              </Text>
              {prevScores && (
                <Text style={[S.tableCell, { flex: 1, textAlign: 'center', color: delta && delta > 0 ? '#4A7A32' : delta && delta < 0 ? PALETTE.amber : PALETTE.ink2 }]}>
                  {delta !== undefined ? (delta > 0 ? `+${delta}` : String(delta)) : '—'}
                </Text>
              )}
              <View style={{ flex: 2, justifyContent: 'center' }}>
                <ScoreBar value={score} />
              </View>
            </View>
          )
        })}

        {/* Overall row */}
        <View style={[S.tableRow, { backgroundColor: '#F2EFC8' }]}>
          <Text style={[S.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>Overall</Text>
          <Text style={[S.tableCell, { flex: 1, textAlign: 'center', fontFamily: 'Helvetica-Bold' }]}>
            {scores.overall}
          </Text>
          {prevScores && (() => {
            const d = scores.overall - prevScores.overall
            return (
              <Text style={[S.tableCell, { flex: 1, textAlign: 'center', fontFamily: 'Helvetica-Bold', color: d > 0 ? '#4A7A32' : d < 0 ? PALETTE.amber : PALETTE.ink2 }]}>
                {d > 0 ? `+${d}` : String(d)}
              </Text>
            )
          })()}
          <View style={{ flex: 2, justifyContent: 'center' }}>
            <ScoreBar value={scores.overall} />
          </View>
        </View>
      </View>
    </PDFPageShell>
  )
}
