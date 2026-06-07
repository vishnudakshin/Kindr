import { View, Text } from '@react-pdf/renderer'
import { PDFPageShell } from './PDFPageShell'
import { S, PALETTE } from './styles'
import type { SymptomsResponses } from '@/lib/types'

const ALL_PHYSICAL = [
  'Headaches', 'Joint pain', 'Muscle aches', 'Back pain', 'Chest tightness',
  'Shortness of breath', 'Bloating / digestive discomfort', 'Skin issues', 'Hair loss',
]
const ALL_ENERGY = [
  'Fatigue', 'Afternoon crashes', 'Low motivation', 'Mood swings',
  'Anxiety / racing thoughts', 'Brain fog', 'Poor concentration', 'Irritability',
]

function SymptomRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <View style={S.symptomRow}>
      <Text style={[S.symptomTick, { color: checked ? '#4A7A32' : PALETTE.border }]}>
        {checked ? '✓' : '✗'}
      </Text>
      <Text style={[S.symptomText, { color: checked ? PALETTE.ink : PALETTE.ink2 }]}>{label}</Text>
    </View>
  )
}

interface Props {
  symptoms: SymptomsResponses
  footerText: string
  pageNumber: number
}

export function PDFSymptoms({ symptoms, footerText, pageNumber }: Props) {
  return (
    <PDFPageShell footerText={footerText} pageNumber={pageNumber}>
      <Text style={S.sectionHeading}>Functional Symptoms</Text>
      <View style={S.sectionRule} />

      <View style={{ flexDirection: 'row', marginBottom: 16, gap: 24 }}>
        {/* Physical */}
        <View style={{ flex: 1 }}>
          <Text style={[S.muted, { marginBottom: 6, fontFamily: 'Helvetica-Bold' }]}>Physical</Text>
          {ALL_PHYSICAL.map(s => (
            <SymptomRow key={s} label={s} checked={symptoms.physical.includes(s)} />
          ))}
        </View>

        {/* Energy & mood */}
        <View style={{ flex: 1 }}>
          <Text style={[S.muted, { marginBottom: 6, fontFamily: 'Helvetica-Bold' }]}>Energy & mood</Text>
          {ALL_ENERGY.map(s => (
            <SymptomRow key={s} label={s} checked={symptoms.energyMood.includes(s)} />
          ))}
        </View>
      </View>

      {symptoms.otherSymptoms && (
        <View style={{ marginBottom: 10 }}>
          <Text style={[S.muted, { marginBottom: 3 }]}>Other</Text>
          <Text style={S.body}>{symptoms.otherSymptoms}</Text>
        </View>
      )}
    </PDFPageShell>
  )
}
