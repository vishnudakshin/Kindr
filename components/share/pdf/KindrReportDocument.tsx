import { Document } from '@react-pdf/renderer'
import { PDFCoverPage }        from './PDFCoverPage'
import { PDFWellnessScores }   from './PDFWellnessScores'
import { PDFLabResults }       from './PDFLabResults'
import { PDFQuestionnaire }    from './PDFQuestionnaire'
import { PDFSymptoms }         from './PDFSymptoms'
import { PDFPlanAdherence }    from './PDFPlanAdherence'
import { PDFJourneySnapshot }  from './PDFJourneySnapshot'
import type { SectionId, RelationshipType } from '@/lib/types'
import { mockData } from '@/lib/data'

interface Props {
  sections: Record<SectionId, boolean>
  recipientName?: string
  relationship?: RelationshipType
}

export function KindrReportDocument({ sections, recipientName, relationship }: Props) {
  const { user, currentScores, bloodPanel, questionnaire, planItems, currentCycle, scoreHistory } = mockData

  const today       = new Date().toISOString().split('T')[0]
  const start       = new Date(currentCycle.startDate + 'T00:00:00Z')
  const now         = new Date(today + 'T00:00:00Z')
  const cycleDay    = Math.max(1, Math.round((now.getTime() - start.getTime()) / 86_400_000) + 1)
  const reportDate  = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const footerText  = `Generated ${reportDate}  ·  Cycle day ${cycleDay} of 90`

  const prevScores = scoreHistory.length >= 2
    ? scoreHistory[scoreHistory.length - 2].scores
    : undefined

  // Build sequential page numbers
  let pageNum = 1
  const nextPage = () => ++pageNum

  const enabledSections = Object.entries(sections)
    .filter(([, on]) => on)
    .map(([k]) => k as SectionId)

  return (
    <Document
      title="Your Kindr Report"
      author="Kindr"
      subject="Wellness Report"
    >
      <PDFCoverPage
        userName={user.name}
        reportDate={reportDate}
        cycleDay={cycleDay}
        recipientName={recipientName}
        relationship={relationship}
        footerText={footerText}
      />

      {sections.wellnessScores && (
        <PDFWellnessScores
          scores={currentScores}
          prevScores={prevScores}
          footerText={footerText}
        />
      )}

      {sections.labResults && (
        <PDFLabResults
          bloodPanel={bloodPanel}
          footerText={footerText}
          pageNumber={nextPage()}
        />
      )}

      {sections.questionnaireAnswers && (
        <PDFQuestionnaire
          questionnaire={questionnaire}
          footerText={footerText}
          pageNumber={nextPage()}
        />
      )}

      {sections.functionalSymptoms && (
        <PDFSymptoms
          symptoms={questionnaire.symptoms}
          footerText={footerText}
          pageNumber={nextPage()}
        />
      )}

      {sections.planAdherence && (
        <PDFPlanAdherence
          cycle={currentCycle}
          planItems={planItems}
          footerText={footerText}
          pageNumber={nextPage()}
        />
      )}

      {sections.journeySnapshot && (
        <PDFJourneySnapshot
          cycle={currentCycle}
          today={today}
          footerText={footerText}
          pageNumber={nextPage()}
        />
      )}
    </Document>
  )
}
