import { View, Text } from '@react-pdf/renderer'
import { PDFPageShell } from './PDFPageShell'
import { S, PALETTE } from './styles'
import type { AssessmentCycle, PlanItem } from '@/lib/types'

function AdherenceBar({ label, pct }: { label: string; pct: number }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
        <Text style={S.barLabel}>{label}</Text>
        <Text style={S.barPct}>{Math.round(pct * 100)}%</Text>
      </View>
      <View style={S.barOuter}>
        <View style={[S.barInner, { width: `${pct * 100}%` as unknown as number }]} />
      </View>
    </View>
  )
}

interface Props {
  cycle: AssessmentCycle
  planItems: PlanItem[]
  footerText: string
  pageNumber: number
}

export function PDFPlanAdherence({ cycle, planItems, footerText, pageNumber }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const last30 = cycle.days.filter(d => d.date >= cutoffStr && d.date <= today)
  const avgPct = last30.length
    ? last30.reduce((sum, d) => sum + d.tasksCompleted / Math.max(d.tasksTotal, 1), 0) / last30.length
    : 0

  // Category breakdown from plan items
  const categories = ['Nutrition', 'Mind & Body', 'Fitness'] as const
  const catPcts = categories.map(cat => {
    const items = planItems.filter(p => p.category === cat)
    const done  = items.filter(p => p.completed).length
    return { cat, pct: items.length ? done / items.length : 0 }
  })

  const daysTended = last30.filter(d => d.tasksCompleted > 0).length
  const fullDays   = last30.filter(d => d.tasksCompleted >= d.tasksTotal).length

  return (
    <PDFPageShell footerText={footerText} pageNumber={pageNumber}>
      <Text style={S.sectionHeading}>Plan Adherence</Text>
      <View style={S.sectionRule} />

      <Text style={[S.muted, { marginBottom: 12 }]}>Last 30 days of your 90-day cycle</Text>

      <AdherenceBar label="Average daily completion" pct={avgPct} />

      <View style={{ flexDirection: 'row', gap: 20, marginTop: 4, marginBottom: 14 }}>
        <View>
          <Text style={[S.muted, { marginBottom: 2 }]}>Days tended</Text>
          <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: PALETTE.ink }}>{daysTended}</Text>
        </View>
        <View>
          <Text style={[S.muted, { marginBottom: 2 }]}>Full days</Text>
          <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: PALETTE.ink }}>{fullDays}</Text>
        </View>
        <View>
          <Text style={[S.muted, { marginBottom: 2 }]}>Days tracked</Text>
          <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: PALETTE.ink }}>{last30.length}</Text>
        </View>
      </View>

      <Text style={[S.muted, { marginBottom: 8, fontFamily: 'Helvetica-Bold' }]}>Today's plan completion by category</Text>
      {catPcts.map(({ cat, pct }) => (
        <AdherenceBar key={cat} label={cat} pct={pct} />
      ))}
    </PDFPageShell>
  )
}
