import { View, Text } from '@react-pdf/renderer'
import { PDFPageShell } from './PDFPageShell'
import { S } from './styles'
import type { QuestionnaireResponses } from '@/lib/types'
import { scoreStress, scoreSleep, scoreNutrition, scoreActivity, scoreCognition } from '@/lib/scoring'

// ── Friendly label helpers ────────────────────────────────────────────────────

const SLEEP_DURATION = ['', '<3 h', '3–4 h', '5–6 h', '7 h', '7–8 h', '9+ h']
const SLEEP_LATENCY  = ['', '<5 min', '5–10 min', '11–20 min', '21–30 min', '31–60 min', '60+ min']
const SLEEP_WAKING   = ['Rarely', '1–2×/week', '3–4×/week', 'Nightly']

const STRESS_LEVELS: [number, string][] = [[25, 'low'], [50, 'moderate'], [75, 'high'], [100, 'very high']]
function stressLabel(score: number) {
  return STRESS_LEVELS.find(([t]) => score <= t)?.[1] ?? 'very high'
}

const RESTEDNESS = ['', 'Very poor', 'Poor', 'Fair', 'Good', 'Excellent']

function pssRaw(r: QuestionnaireResponses['stress']): number {
  return r.q1 + (6 - r.q2) + r.q3 + (6 - r.q4)
}

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
  const { history, stress, sleep, activity, nutrition, cognition } = questionnaire

  const stressScore = scoreStress(stress)
  const pss         = pssRaw(stress)
  const sleepScore  = scoreSleep(sleep)
  const nutritionScore = scoreNutrition(nutrition)
  const activityScore  = scoreActivity(activity)
  const cognitionScore = scoreCognition(cognition)

  return (
    <PDFPageShell footerText={footerText} pageNumber={pageNumber}>
      <Text style={S.sectionHeading}>Questionnaire Summary</Text>
      <View style={S.sectionRule} />

      <QSection label="Personal">
        <QRow label="Sex" value={history.sex || 'Not provided'} />
        <QRow label="Dietary preferences" value={history.dietaryPreferences.join(', ') || 'None specified'} />
        <QRow label="Medications / supplements" value={history.medicationsText || 'None'} />
        <QRow label="Known allergies" value={history.allergies === 'None known' ? 'None' : (history.allergiesText || history.allergies)} />
        <QRow label="Family history" value={history.familyHistory.join(', ')} />
      </QSection>

      <QSection label={`Stress  (PSS-4 · score ${pss}/16 — ${stressLabel(stressScore)})`}>
        <QRow label="Unable to control things" value={String(stress.q1)} />
        <QRow label="Confident handling problems" value={String(stress.q2)} />
        <QRow label="Difficulties piling up" value={String(stress.q3)} />
        <QRow label="Things going your way" value={String(stress.q4)} />
        <QRow label="Wellness score" value={`${stressScore} / 100`} />
      </QSection>

      <QSection label={`Sleep  (score ${sleepScore}/100)`}>
        <QRow label="Duration" value={SLEEP_DURATION[sleep.duration] ?? '—'} />
        <QRow label="Time to fall asleep" value={SLEEP_LATENCY[sleep.latency] ?? '—'} />
        <QRow label="Restedness on waking" value={RESTEDNESS[sleep.restedness] ?? '—'} />
        <QRow label="Night wakings" value={SLEEP_WAKING[sleep.waking] ?? '—'} />
      </QSection>

      <QSection label={`Activity  (score ${activityScore}/100)`}>
        <QRow label="Vigorous days/week" value={String(activity.vigorous)} />
        <QRow label="Moderate days/week" value={String(activity.moderate)} />
        <QRow label="Energy level (1–5)" value={String(activity.energy)} />
        <QRow label="Sitting hours/day" value={String(activity.sitting)} />
      </QSection>

      <QSection label={`Nutrition  (score ${nutritionScore}/100)`}>
        <QRow label="Fruit & veg servings (1–5)" value={String(nutrition.fruitVeg)} />
        <QRow label="Water intake (1–5)" value={String(nutrition.water)} />
        <QRow label="Processed food (1–5)" value={String(nutrition.processed)} />
        <QRow label="Meal regularity (1–4)" value={String(nutrition.mealRegularity)} />
        <QRow label="Alcohol (1–5)" value={String(nutrition.alcohol)} />
      </QSection>

      <QSection label={`Cognition  (score ${cognitionScore}/100)`}>
        <QRow label="Focus (1–5)" value={String(cognition.focus)} />
        <QRow label="Brain fog (1–5)" value={String(cognition.fog)} />
        <QRow label="Memory (1–5)" value={String(cognition.memory)} />
        <QRow label="Losing train of thought (1–5)" value={String(cognition.trainOfThought)} />
        <QRow label="Word finding difficulty (1–5)" value={String(cognition.wordFinding)} />
      </QSection>
    </PDFPageShell>
  )
}
