'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { IconChevronLeft, IconAlertCircle } from '@tabler/icons-react'
import { mockData, saveShareRecord } from '@/lib/data'
import type { SectionId, RelationshipType } from '@/lib/types'

// Lazy-load the PDF generator — it imports @react-pdf/renderer which is large
const generatePDF = async (
  sections: Record<SectionId, boolean>,
  recipientName: string,
  relationship: RelationshipType | null,
) => {
  const { pdf } = await import('@react-pdf/renderer')
  const { KindrReportDocument } = await import('./pdf/KindrReportDocument')
  const doc = (
    <KindrReportDocument
      sections={sections}
      recipientName={recipientName || undefined}
      relationship={relationship ?? undefined}
    />
  )
  return pdf(doc).toBlob()
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_SECTIONS: { id: SectionId; label: string; description: string }[] = [
  { id: 'wellnessScores',       label: 'Wellness Scores',       description: 'Radar chart of 5 dimensions + scores vs. last cycle' },
  { id: 'labResults',           label: 'Lab Results',           description: 'All blood panels, reference ranges and flags' },
  { id: 'questionnaireAnswers', label: 'Questionnaire Answers', description: 'Friendly summaries of your lifestyle responses' },
  { id: 'functionalSymptoms',   label: 'Functional Symptoms',   description: 'Physical and energy/mood symptoms you reported' },
  { id: 'planAdherence',        label: 'Plan Adherence',        description: 'Average daily completion over the last 30 days' },
  { id: 'journeySnapshot',      label: 'Journey Snapshot',      description: 'Your 90-day grove rendered into the report' },
]

const RELATIONSHIPS: { id: RelationshipType; label: string }[] = [
  { id: 'doctor',  label: 'Doctor' },
  { id: 'coach',   label: 'Coach' },
  { id: 'partner', label: 'Partner' },
  { id: 'family',  label: 'Family' },
  { id: 'friend',  label: 'Friend' },
  { id: 'other',   label: 'Other' },
]

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-ink' : 'bg-border'}`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-card transition-transform ${on ? 'translate-x-5' : 'translate-x-1'}`}
      />
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ShareReportScreen() {
  const router = useRouter()
  const { user, questionnaire } = mockData

  const [recipientName, setRecipientName] = useState('')
  const [relationship,  setRelationship]  = useState<RelationshipType | null>(null)
  const [sections, setSections] = useState<Record<SectionId, boolean>>({
    wellnessScores:       true,
    labResults:           true,
    questionnaireAnswers: true,
    functionalSymptoms:   true,
    planAdherence:        true,
    journeySnapshot:      true,
  })
  const [isGenerating, setIsGenerating] = useState(false)

  // Lab gate: lab results toggled on but profile missing DOB / sex
  const hasRequiredForLabs =
    !!questionnaire.history.sex

  const showLabGate = sections.labResults && !hasRequiredForLabs

  const enabledCount = Object.values(sections).filter(Boolean).length

  function toggleSection(id: SectionId) {
    setSections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleDownload = useCallback(async () => {
    if (isGenerating || enabledCount === 0) return
    setIsGenerating(true)
    try {
      const blob = await generatePDF(sections, recipientName, relationship)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `kindr-report-${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      // Log the share record
      const enabledSections = (Object.keys(sections) as SectionId[]).filter(k => sections[k])
      saveShareRecord(enabledSections, recipientName || undefined, relationship ?? undefined)

      router.back()
    } catch (err) {
      console.error('PDF generation failed', err)
    } finally {
      setIsGenerating(false)
    }
  }, [sections, recipientName, relationship, isGenerating, enabledCount, router])

  return (
    <div className="min-h-screen bg-bg">
      {/* Nav bar */}
      <div className="sticky top-0 z-10 bg-bg border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-bg-soft transition-colors"
        >
          <IconChevronLeft size={20} strokeWidth={1.8} className="text-ink" />
        </button>
        <h1 className="font-serif text-[18px] font-medium text-ink">Share my report</h1>
      </div>

      <div className="px-5 pt-5 pb-32 flex flex-col gap-6 max-w-lg mx-auto">

        {/* Recipient fields */}
        <div className="bg-card rounded-2xl border border-border p-5 flex flex-col gap-4">
          <p className="text-[11px] tracking-[.07em] uppercase text-ink-2">Recipient (optional)</p>

          <div>
            <label className="text-[12px] text-ink-2 mb-1.5 block">Who is this for?</label>
            <input
              type="text"
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              placeholder="e.g. Dr Sharma, Sarah, Mum…"
              className="w-full text-[13px] text-ink bg-bg-soft border border-border rounded-xl px-3 py-2.5 outline-none focus:border-ink transition-colors placeholder:text-ink-2"
            />
          </div>

          <div>
            <label className="text-[12px] text-ink-2 mb-2 block">Their relationship to you</label>
            <div className="flex flex-wrap gap-2">
              {RELATIONSHIPS.map(r => (
                <button
                  key={r.id}
                  onClick={() => setRelationship(prev => prev === r.id ? null : r.id)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                    relationship === r.id
                      ? 'bg-ink text-card'
                      : 'bg-bg-soft border border-border text-ink-2 hover:border-ink-2'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section toggles */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-4">Include in report</p>
          <div className="flex flex-col divide-y divide-border">
            {ALL_SECTIONS.map(section => (
              <div key={section.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink">{section.label}</p>
                  <p className="text-[11px] text-ink-2 mt-0.5 leading-relaxed">{section.description}</p>
                </div>
                <Toggle on={sections[section.id]} onChange={() => toggleSection(section.id)} />
              </div>
            ))}
          </div>
        </div>

        {/* Lab gate warning */}
        {showLabGate && (
          <div className="bg-[#FDF6E8] border border-[#E8C870] rounded-2xl p-4 flex items-start gap-3">
            <IconAlertCircle size={18} strokeWidth={1.8} className="text-[#B8842A] shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-medium text-[#B8842A] mb-1">Sex required for lab reference ranges</p>
              <p className="text-[12px] text-[#8A6020] leading-relaxed">
                Reference ranges vary by biological sex. Add your sex in Profile to make lab values meaningful for your recipient.
              </p>
              <button
                onClick={() => router.push('/profile')}
                className="mt-2 text-[12px] font-medium text-[#B8842A] underline underline-offset-2"
              >
                Complete profile →
              </button>
            </div>
          </div>
        )}

        {/* Preview summary */}
        <div className="bg-bg-soft rounded-2xl border border-border p-4">
          <p className="text-[12px] text-ink-2 mb-2">Your report will include:</p>
          {enabledCount === 0 ? (
            <p className="text-[13px] text-ink-2 italic">No sections selected.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {ALL_SECTIONS.filter(s => sections[s.id]).map(s => (
                <span key={s.id} className="px-2.5 py-1 rounded-full bg-accent text-ink text-[11px] font-medium">
                  {s.label}
                </span>
              ))}
            </div>
          )}
          {recipientName && (
            <p className="text-[12px] text-ink-2 mt-2">
              For <span className="text-ink font-medium">{recipientName}</span>
              {relationship && ` · ${RELATIONSHIPS.find(r => r.id === relationship)?.label}`}
            </p>
          )}
        </div>

      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-bg border-t border-border px-5 py-4">
        <p className="text-[11px] text-ink-2 text-center mb-3 leading-relaxed">
          This report contains personal health information. Share it only with people you trust.
        </p>
        <button
          onClick={handleDownload}
          disabled={isGenerating || enabledCount === 0}
          className="w-full max-w-lg mx-auto flex items-center justify-center py-3.5 rounded-full bg-ink text-[#F5F0D0] text-[13px] font-medium transition-opacity disabled:opacity-50"
        >
          {isGenerating ? 'Generating PDF…' : 'Download PDF'}
        </button>
      </div>
    </div>
  )
}
