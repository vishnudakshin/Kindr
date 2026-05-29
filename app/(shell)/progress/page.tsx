import { BrandHeader } from '@/components/ui/BrandHeader'

export default function ProgressPage() {
  return (
    <>
      <BrandHeader />
      <div className="px-6 pt-5">
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1.5">Progress</p>
        <h1 className="font-serif text-[28px] font-medium text-ink leading-snug">
          Your journey so far
        </h1>
        <p className="text-[14px] text-ink-2 mt-2 leading-relaxed">
          Score trends, forest growth animation, milestones, and reassessment will live here.
        </p>
      </div>
    </>
  )
}
