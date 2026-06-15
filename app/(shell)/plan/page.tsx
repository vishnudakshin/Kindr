'use client'

import { BrandHeader } from '@/components/ui/BrandHeader'
import { PlanClient } from '@/components/plan/PlanClient'
import { dailyPlanV2 } from '@/lib/data'

export default function PlanPage() {
  return (
    <>
      <BrandHeader />
      <div className="px-5 pt-4 pb-24">
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1">Your plan</p>
        <h1 className="font-serif text-[30px] font-medium text-ink leading-snug mb-1">
          Daily actions.
        </h1>
        <p className="text-[14px] text-ink-2 mt-1 mb-6 leading-relaxed">
          Small, consistent actions. Tick them off as you go.
        </p>
        <PlanClient plan={dailyPlanV2} />
      </div>
    </>
  )
}
