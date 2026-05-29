import { BrandHeader } from '@/components/ui/BrandHeader'

export default function LabsPage() {
  return (
    <>
      <BrandHeader />
      <div className="px-6 pt-5">
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1.5">Blood panel</p>
        <h1 className="font-serif text-[28px] font-medium text-ink leading-snug">
          Your lab results
        </h1>
        <p className="text-[14px] text-ink-2 mt-2 leading-relaxed">
          Body model, system statuses, and trend sparklines will live here.
        </p>
      </div>
    </>
  )
}
