import { BrandHeader } from '@/components/ui/BrandHeader'
import { WellnessRadar } from '@/components/dashboard/WellnessRadar'
import { BodyModel } from '@/components/dashboard/BodyModel'
import { mockData } from '@/lib/data'

export default function DashboardPage() {
  const { user, currentScores } = mockData

  return (
    <>
      <BrandHeader />
      <div className="px-6 pt-4 pb-10">

        {/* Greeting */}
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1">Overview</p>
        <h1 className="font-serif text-[30px] font-medium text-ink leading-snug">
          Hello, {user.name}.
        </h1>
        <p className="text-[14px] text-ink-2 mt-1 mb-8 leading-relaxed">
          Here's where things stand today.
        </p>

        {/* Radar */}
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-3">
          Wellness scores
        </p>
        <WellnessRadar scores={currentScores} />

        {/* Body model */}
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mt-10 mb-1">
          Body systems
        </p>
        <p className="text-[13px] text-ink-2 mb-5 leading-relaxed">
          Tap any system to see your markers in detail.
        </p>
        <BodyModel />
        <p className="text-[12px] text-ink-2 mt-4 leading-relaxed">
          Head over to labs for a detailed overview of your markers.
        </p>

      </div>
    </>
  )
}
