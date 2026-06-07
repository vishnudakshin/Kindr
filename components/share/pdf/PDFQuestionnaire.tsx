import { View, Text } from '@react-pdf/renderer'
import { PDFPageShell } from './PDFPageShell'
import { S } from './styles'
import type { QuestionnaireResponses } from '@/lib/types'
import { scoreStress, scoreSleep, scoreNutrition, scoreActivity, scoreCognition, scoreWellbeing } from '@/lib/scoring'

interface SectionProps { label: string; children: React.ReactNode }
function QSection({ label, children }: SectionProps) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>{label}</Text>
      {children}
    </View>
  )
}

function QRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 3 }}>
      <Text style={[S.muted, { width: 140, flexShrink: 0 }]}>{label}</Text>
      <Text style={S.body}>{value || '—'}</Text>
    </View>
  )
}

interface Props {
  questionnaire: QuestionnaireResponses
  footerText: string
  pageNumber: number
}

export function PDFQuestionnaire({ questionnaire, footerText, pageNumber }: Props) {
  const { history, stress, sleep, activity, nutrition, cognition, wellbeing } = questionnaire

  const stressResult    = scoreStress(stress)
  const sleepResult     = scoreSleep(sleep)
  const activityResult  = scoreActivity(activity)
  const nutritionResult = scoreNutrition(nutrition)
  const cognitionResult = scoreCognition(cognition)
  const wellbeingResult = scoreWellbeing(wellbeing)

  const sleepMeta = sleepResult.meta as { tScore: number } | undefined
  const cogMeta   = cognitionResult.meta as { tScore: number } | undefined

  return (
    <PDFPageShell footerText={footerText} pageNumber={pageNumber}>
      <Text style={S.sectionHeading}>Questionnaire Summary</Text>
      <View style={S.sectionRule} />

      <QSection label="Personal">
        <QRow label="Sex"                          value={history.sex || 'Not provided'} />
        <QRow label="Age"                          value={history.age != null ? `${history.age} years` : 'Not provided'} />
        <QRow label="Ethnicity"                    value={history.ethnicity ?? 'general'} />
        <QRow label="Dietary preferences"          value={history.dietaryPreferences.join(', ') || 'None specified'} />
        <QRow label="Medications / supplements"    value={history.medicationsText || 'None'} />
        <QRow label="Known allergies"              value={history.allergies === 'None known' ? 'None' : (history.allergiesText || history.allergies)} />
        <QRow label="Family history"               value={history.familyHistory.join(', ')} />
      </QSection>

      <QSection label={`Stress  (PSS-10 · raw ${stressResult.raw}/40 — ${stressResult.band})`}>
        <QRow label="Wellness score"    value={`${stressResult.wellness} / 100`} />
        <QRow label="Band"              value={stressResult.band} />
        <QRow label="Elevated?"         value={stressResult.flags.includes('elevated_stress') ? 'Yes' : 'No'} />
      </QSection>

      <QSection label={`Activity  (EVS · ${activityResult.band})`}>
        <QRow label="MVPA days/week"     value={String(activity.mvpaDays)} />
        <QRow label="MVPA min/session"   value={String(activity.mvpaMinutes)} />
        <QRow label="Strength days/week" value={String(activity.strengthDays)} />
        <QRow label="Sitting hrs/day"    value={String(activity.sittingHours)} />
        <QRow label="Wellness score"     value={`${activityResult.wellness} / 100`} />
      </QSection>

      <QSection label={`Sleep  (PROMIS 8a · T ${sleepMeta?.tScore ?? '—'} — ${sleepResult.band})`}>
        <QRow label="Raw score (8–40)"   value={String(sleepResult.raw)} />
        <QRow label="PROMIS T-score"     value={sleepMeta ? String(sleepMeta.tScore) : '—'} />
        <QRow label="Wellness score"     value={`${sleepResult.wellness} / 100`} />
      </QSection>

      <QSection label={`Nutrition  (STC · ${nutritionResult.band})`}>
        <QRow label="STC raw (0–16)"     value={`${nutritionResult.raw} (higher = less healthy)`} />
        <QRow label="Wellness score"     value={`${nutritionResult.wellness} / 100`} />
      </QSection>

      <QSection label={`Cognition  (PROMIS 4a · T ${cogMeta?.tScore ?? '—'} — ${cognitionResult.band})`}>
        <QRow label="Raw score (4–20)"   value={String(cognitionResult.raw)} />
        <QRow label="PROMIS T-score"     value={cogMeta ? String(cogMeta.tScore) : '—'} />
        <QRow label="Wellness score"     value={`${cognitionResult.wellness} / 100`} />
      </QSection>

      <QSection label={`Wellbeing  (WHO-5 · ${wellbeingResult.band})`}>
        <QRow label="Raw score (0–25)"   value={String(wellbeingResult.raw)} />
        <QRow label="WHO-5 %"            value={`${wellbeingResult.wellness}%`} />
        <QRow label="Band"               value={wellbeingResult.band} />
      </QSection>
    </PDFPageShell>
  )
}
