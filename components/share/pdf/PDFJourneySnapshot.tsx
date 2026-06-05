import { View, Text, Svg, Polygon as PDFPolygon, G } from '@react-pdf/renderer'
import { PDFPageShell } from './PDFPageShell'
import { S, PALETTE } from './styles'
import type { AssessmentCycle } from '@/lib/types'

// Miniature isometric grove for the PDF — no framer-motion, no state, pure geometry
const COLS = 10, ROWS = 9
const TW = 14, TH = 7, HW = 7, HH = 3.5
const OX = ROWS * HW        // 63
const OY = 20

function tileTop(col: number, row: number) {
  return { x: OX + (col - row) * HW, y: OY + (col + row) * HH }
}

function diamondPts(col: number, row: number): string {
  const { x, y } = tileTop(col, row)
  return `${x},${y} ${x + HW},${y + HH} ${x},${y + TH} ${x - HW},${y + HH}`
}

function toStage(completed: number, total: number, isFuture: boolean): number {
  if (isFuture || completed === 0) return 0
  const s = Math.round((completed / Math.max(total, 1)) * 10)
  if (s <= 1) return 1
  if (s <= 4) return 2
  if (s <= 6) return 3
  if (s <= 9) return 4
  return 5
}

const STAGE_FILLS = ['', '#4A7A32', '#5A9040', '#6AAA4A', '#7AC055', '#94CC38']

const SVG_W = (COLS + ROWS) * HW  // 133
const SVG_H = OY + (COLS + ROWS) * HH + TH + 4  // ≈ 99

interface Props {
  cycle: AssessmentCycle
  today: string
  footerText: string
  pageNumber: number
}

export function PDFJourneySnapshot({ cycle, today, footerText, pageNumber }: Props) {
  function addDays(dateStr: string, n: number): string {
    const d = new Date(dateStr + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().split('T')[0]
  }

  const entries = Array.from({ length: COLS * ROWS }, (_, i) => {
    const col  = i % COLS
    const row  = Math.floor(i / COLS)
    const date = addDays(cycle.startDate, i)
    const entry = cycle.days.find(d => d.date === date)
    const isFuture = date > today
    return {
      col, row, date, isFuture,
      completed: isFuture ? 0 : (entry?.tasksCompleted ?? 0),
      total:     entry?.tasksTotal ?? 10,
    }
  })

  const paintOrder = [...entries].sort((a, b) =>
    (a.col + a.row) - (b.col + b.row) || a.col - b.col
  )

  const daysTended = entries.filter(e => !e.isFuture && e.completed > 0).length

  return (
    <PDFPageShell footerText={footerText} pageNumber={pageNumber}>
      <Text style={S.sectionHeading}>Your 90-Day Grove</Text>
      <View style={S.sectionRule} />

      <Text style={[S.muted, { marginBottom: 12 }]}>
        {daysTended} of 90 days tended  ·  {entries.filter(e => !e.isFuture && e.completed >= e.total).length} full days
      </Text>

      {/* Isometric forest */}
      <View style={{ alignItems: 'center' }}>
        <Svg width={SVG_W * 3.2} height={SVG_H * 3.2} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
          {paintOrder.map(entry => {
            const { col, row } = entry
            const stage = toStage(entry.completed, entry.total, entry.isFuture)
            const grassFill = entry.isFuture ? '#527A22' : '#78BA38'

            return (
              <G key={entry.date}>
                <PDFPolygon
                  points={diamondPts(col, row)}
                  fill={grassFill}
                  stroke="rgba(30,60,10,0.3)"
                  strokeWidth={0.3}
                />
                {stage > 0 && (() => {
                  const { x: bx, y: by } = tileTop(col, row)
                  const baseY = by + TH * 0.65
                  const treeFill = STAGE_FILLS[stage]
                  const r = 2 + stage * 0.8
                  return (
                    <PDFPolygon
                      points={`${bx},${baseY - r * 2.2} ${bx + r},${baseY} ${bx - r},${baseY}`}
                      fill={treeFill}
                    />
                  )
                })()}
              </G>
            )
          })}
        </Svg>
      </View>

      {/* Stage legend */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
        {[
          { stage: 1, label: 'Sapling' },
          { stage: 2, label: 'Young' },
          { stage: 3, label: 'Growing' },
          { stage: 4, label: 'Mature' },
          { stage: 5, label: 'Full oak' },
        ].map(({ stage, label }) => (
          <View key={stage} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: STAGE_FILLS[stage] }} />
            <Text style={S.muted}>{label}</Text>
          </View>
        ))}
      </View>
    </PDFPageShell>
  )
}
