import { BrandHeader } from '@/components/ui/BrandHeader'
import { WellnessReport } from '@/components/report/WellnessReport'

export default function ReportPage() {
  return (
    <>
      <BrandHeader />
      <div className="px-6 pt-4 pb-10">
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1">Report</p>
        <h1 className="font-serif text-[30px] font-medium text-ink leading-snug">
          Your wellness report.
        </h1>
        <p className="text-[14px] text-ink-2 mt-1 mb-8 leading-relaxed">
          A snapshot of your health based on your latest assessment and lab results.
        </p>
        <WellnessReport />
      </div>
    </>
  )
}
