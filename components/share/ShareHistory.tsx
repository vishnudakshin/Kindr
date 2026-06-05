'use client'

import type { ShareRecord, RelationshipType } from '@/lib/types'

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  doctor:  'Doctor',
  coach:   'Coach',
  partner: 'Partner',
  family:  'Family member',
  friend:  'Friend',
  other:   'Trusted person',
}

const SECTION_LABELS: Record<string, string> = {
  wellnessScores:       'Wellness Scores',
  labResults:           'Lab Results',
  questionnaireAnswers: 'Questionnaire',
  functionalSymptoms:   'Symptoms',
  planAdherence:        'Plan Adherence',
  journeySnapshot:      'Grove',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props { records: ShareRecord[] }

export function ShareHistory({ records }: Props) {
  if (!records.length) return null

  return (
    <div>
      <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-3">Shared reports</p>
      <div className="flex flex-col gap-2">
        {records.map(r => (
          <div key={r.id} className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[13px] font-medium text-ink">
                {r.recipientName
                  ? `${r.recipientName}${r.relationship ? ` · ${RELATIONSHIP_LABELS[r.relationship]}` : ''}`
                  : 'Shared report'}
              </p>
              <p className="text-[11px] text-ink-2 shrink-0">{fmtDate(r.date)}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.sections.map(s => (
                <span key={s} className="px-2 py-0.5 rounded-full bg-accent text-ink text-[11px]">
                  {SECTION_LABELS[s] ?? s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
