import { BrandHeader } from '@/components/ui/BrandHeader'
import { WellnessReport } from '@/components/report/WellnessReport'

export default function ReportPage() {
  return (
    <>
      <BrandHeader />
      <div className="px-5 pt-5 pb-24">
        <WellnessReport />
      </div>
    </>
  )
}
