import type { AssessmentCycle } from '@/lib/types'

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

export function PreviousForests({ cycles }: { cycles: AssessmentCycle[] }) {
  return (
    <div className="flex flex-col gap-3">
      {cycles.map(cycle => {
        const tended = cycle.days.filter(d => d.tasksCompleted > 0).length
        const full   = cycle.days.filter(d => d.tasksCompleted >= d.tasksTotal).length
        const score  = cycle.finalScores?.overall

        return (
          <div key={cycle.id} className="rounded-xl bg-card border border-border p-4">
            <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-2">
              {fmtDate(cycle.startDate)}
              {cycle.endDate ? ` — ${fmtDate(cycle.endDate)}` : ''}
            </p>
            <div className="flex gap-5">
              <div>
                <p className="text-[10px] text-ink-2">Days tended</p>
                <p className="font-serif text-[18px] font-medium text-ink leading-tight">{tended}</p>
              </div>
              <div>
                <p className="text-[10px] text-ink-2">Full days</p>
                <p className="font-serif text-[18px] font-medium text-ink leading-tight">{full}</p>
              </div>
              {score !== undefined && (
                <div>
                  <p className="text-[10px] text-ink-2">Final score</p>
                  <p className="font-serif text-[18px] font-medium text-ink leading-tight">{score}</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
