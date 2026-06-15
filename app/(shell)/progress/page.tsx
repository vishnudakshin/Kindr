'use client'

import type { FC } from 'react'
import { BrandHeader } from '@/components/ui/BrandHeader'
import { ScoreTrend } from '@/components/progress/ScoreTrend'
import { ForestGrove } from '@/components/progress/ForestGrove'
import { mockData } from '@/lib/data'
import { IconCircleCheck, IconCalendarEvent, IconSparkles, IconTrophy } from '@tabler/icons-react'

type IconComponent = FC<{ size?: number; strokeWidth?: number; className?: string }>

// ── Milestone derivation ──────────────────────────────────────────────────────

interface Milestone { icon: IconComponent; label: string; date: string }

function getMilestones(data: typeof mockData): Milestone[] {
  const h = data.scoreHistory
  const milestones = []

  if (h.length >= 1) {
    milestones.push({
      icon: IconSparkles,
      label: 'First wellness assessment completed',
      date: h[0].date,
    })
  }
  if (h.length >= 2) {
    const improved = (Object.keys(h[1].scores) as (keyof typeof h[1]['scores'])[])
      .filter(k => k !== 'overall' && h[1].scores[k] > h[0].scores[k])
    if (improved.length > 0) {
      milestones.push({
        icon: IconTrophy,
        label: `${improved.length} dimension${improved.length > 1 ? 's' : ''} improved at 3-month check-in`,
        date: h[1].date,
      })
    }
    if (h[1].scores.overall >= 50 && h[0].scores.overall < 50) {
      milestones.push({
        icon: IconCircleCheck,
        label: 'Crossed the 50-point overall wellness mark',
        date: h[1].date,
      })
    }
  }
  if (h.length >= 3) {
    const first = h[0].scores.overall
    const last  = h[h.length - 1].scores.overall
    if (last - first >= 10) {
      milestones.push({
        icon: IconTrophy,
        label: `Overall wellness up ${last - first} points from baseline`,
        date: h[h.length - 1].date,
      })
    }
  }

  return milestones.reverse()
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysBetween(a: string, b: string) {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function isoAddDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

export default function ProgressPage() {
  const { user, scoreHistory, currentCycle, previousCycles } = mockData
  const milestones = getMilestones(mockData)

  const today           = new Date().toISOString().split('T')[0]
  const daysSinceJoin   = daysBetween(user.dateJoined, today)
  const daysToReassess  = daysBetween(today, user.reassessmentDate)
  const reassessIsPast  = daysToReassess < 0
  const reassessDue     = Math.abs(daysToReassess)

  return (
    <>
      <BrandHeader href="/" />
      <div className="px-6 pt-4 pb-10 flex flex-col gap-8">

        {/* Header */}
        <div>
          <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1">Progress</p>
          <h1 className="font-serif text-[30px] font-medium text-ink leading-snug">
            Your journey so far.
          </h1>
          <p className="text-[14px] text-ink-2 mt-1 leading-relaxed">
            {daysSinceJoin} days since you started.
          </p>
        </div>

        {/* 90-day grove */}
        <ForestGrove
          currentCycle={currentCycle}
          previousCycles={previousCycles}
          today={today}
        />

        {/* Score trend chart */}
        <ScoreTrend history={scoreHistory} />

        {/* Milestones */}
        {milestones.length > 0 && (
          <div>
            <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-4">
              Achievements
            </p>
            <div className="flex flex-col gap-3">
              {milestones.map((m, i) => (
                <div
                  key={i}
                  className="bg-card rounded-2xl border border-border shadow-card p-4 flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0">
                    <m.icon size={16} strokeWidth={1.5} className="text-ink" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink leading-snug">{m.label}</p>
                    <p className="text-[11px] text-ink-2 mt-0.5">{fmtDate(m.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reassessment */}
        <div className="bg-card rounded-2xl border border-border shadow-card p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0">
              <IconCalendarEvent size={16} strokeWidth={1.5} className="text-ink" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-ink">3-month reassessment</p>
              <p className="text-[11px] text-ink-2 mt-0.5">{fmtDate(user.reassessmentDate)}</p>
            </div>
          </div>

          {reassessIsPast ? (
            <>
              <p className="text-[13px] text-ink-2 leading-relaxed mb-4">
                Your reassessment was{' '}
                <span className="text-ink font-medium">{reassessDue} days ago.</span>{' '}
                Retaking it will update your scores and refresh your plan.
              </p>
              <a
                href="/questionnaire"
                className="inline-flex items-center justify-center w-full bg-accent text-ink font-medium text-[13px] rounded-full py-3 hover:bg-[#ddd690] transition-colors"
              >
                Start reassessment
              </a>
            </>
          ) : (
            <p className="text-[13px] text-ink-2 leading-relaxed">
              Coming up in{' '}
              <span className="text-ink font-medium">{reassessDue} days.</span>{' '}
              You'll retake the questionnaire to see how your wellness has shifted.
            </p>
          )}
        </div>

      </div>
    </>
  )
}
