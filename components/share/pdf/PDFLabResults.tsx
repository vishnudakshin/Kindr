import { View, Text } from '@react-pdf/renderer'
import { PDFPageShell } from './PDFPageShell'
import { S, PALETTE } from './styles'
import type { BloodPanel, BloodTestResult } from '@/lib/types'

function FlagDot() {
  return (
    <View style={{
      width: 7, height: 7, borderRadius: 4,
      backgroundColor: PALETTE.amber,
      marginLeft: 4,
      alignSelf: 'center',
    }} />
  )
}

function TestRow({ name, result, alt }: { name: string; result: BloodTestResult; alt: boolean }) {
  const flagged = result.status === 'borderline' || result.status === 'abnormal'
  return (
    <View style={[S.tableRow, alt ? S.tableRowAlt : {}]}>
      <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={S.tableCell}>{name}</Text>
        {flagged && <FlagDot />}
      </View>
      <Text style={[S.tableCell, { flex: 1.5, textAlign: 'right', fontFamily: flagged ? 'Helvetica-Bold' : 'Helvetica' }]}>
        {result.value || '—'}
      </Text>
      <Text style={[S.tableCellMuted, { flex: 1.5, textAlign: 'right' }]}>{result.unit}</Text>
      <Text style={[S.tableCellMuted, { flex: 2.5, textAlign: 'right' }]}>{result.refRange}</Text>
    </View>
  )
}

interface Props {
  bloodPanel: BloodPanel
  footerText: string
  pageNumber: number
}

export function PDFLabResults({ bloodPanel, footerText, pageNumber }: Props) {
  const panels = Object.entries(bloodPanel).filter(
    ([, tests]) => Object.values(tests).some(t => t.value !== '')
  )

  return (
    <PDFPageShell footerText={footerText} pageNumber={pageNumber}>
      <Text style={S.sectionHeading}>Lab Results</Text>
      <View style={S.sectionRule} />

      {/* Legend */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: PALETTE.amber, marginRight: 5 }} />
        <Text style={S.muted}>Value outside reference range</Text>
      </View>

      {panels.map(([panelName, tests]) => {
        const activeTests = Object.entries(tests).filter(([, r]) => r.value !== '')
        if (!activeTests.length) return null

        return (
          <View key={panelName} wrap={false}>
            <Text style={S.panelHeading}>{panelName}</Text>

            {/* Column headers */}
            <View style={S.tableHeader}>
              <Text style={[S.tableHeadCell, { flex: 3 }]}>Test</Text>
              <Text style={[S.tableHeadCell, { flex: 1.5, textAlign: 'right' }]}>Value</Text>
              <Text style={[S.tableHeadCell, { flex: 1.5, textAlign: 'right' }]}>Units</Text>
              <Text style={[S.tableHeadCell, { flex: 2.5, textAlign: 'right' }]}>Reference</Text>
            </View>

            {activeTests.map(([testName, result], i) => (
              <TestRow key={testName} name={testName} result={result} alt={i % 2 === 1} />
            ))}
          </View>
        )
      })}
    </PDFPageShell>
  )
}
