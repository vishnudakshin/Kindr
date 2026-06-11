import { BrandHeader } from '@/components/ui/BrandHeader'
import { PlanClient } from '@/components/plan/PlanClient'
import { WellnessReport } from '@/components/plan/WellnessReport'
import { mockData } from '@/lib/data'

export default function PlanPage() {
  return (
    <>
      <BrandHeader />
      <div className="px-6 pt-4 pb-10">

        <WellnessReport />

        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1">Your plan</p>
        <h1 className="font-serif text-[30px] font-medium text-ink leading-snug mb-1">
          Daily recommendations
        </h1>
        <p className="text-[14px] text-ink-2 mt-1 mb-8 leading-relaxed">
          Small, consistent actions. Tick them off as you go.
        </p>

        <PlanClient initialItems={mockData.planItems} />
      </div>
    </>
  )
}
