import { View, Text } from '@react-pdf/renderer'
import { PDFPageShell } from './PDFPageShell'
import { S } from './styles'
import type { RelationshipType } from '@/lib/types'

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  doctor:  'Doctor',
  coach:   'Coach',
  partner: 'Partner',
  family:  'Family member',
  friend:  'Friend',
  other:   'Trusted person',
}

interface Props {
  userName: string
  reportDate: string
  cycleDay: number
  recipientName?: string
  relationship?: RelationshipType
  footerText: string
}

export function PDFCoverPage({ userName, reportDate, cycleDay, recipientName, relationship, footerText }: Props) {
  return (
    <PDFPageShell footerText={footerText}>
      <View style={S.coverSpacer} />

      <Text style={S.coverTitle}>Your Kindr report</Text>
      <Text style={S.coverSubtitle}>A snapshot of your wellness journey.</Text>

      <View style={S.coverRule} />

      <Text style={S.coverMeta}>
        <Text style={S.coverMetaLabel}>Prepared for  </Text>
        {userName}
      </Text>
      <Text style={S.coverMeta}>
        <Text style={S.coverMetaLabel}>Report date  </Text>
        {reportDate}
      </Text>
      <Text style={S.coverMeta}>
        <Text style={S.coverMetaLabel}>Cycle day  </Text>
        {cycleDay} of 90
      </Text>

      {recipientName && (
        <Text style={[S.coverMeta, { marginTop: 12 }]}>
          <Text style={S.coverMetaLabel}>For  </Text>
          {recipientName}
          {relationship ? `  ·  ${RELATIONSHIP_LABELS[relationship]}` : ''}
        </Text>
      )}
    </PDFPageShell>
  )
}
