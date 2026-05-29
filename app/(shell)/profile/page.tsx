import { BrandHeader } from '@/components/ui/BrandHeader'

export default function ProfilePage() {
  return (
    <>
      <BrandHeader />
      <div className="px-6 pt-5">
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1.5">Profile</p>
        <h1 className="font-serif text-[28px] font-medium text-ink leading-snug">
          Your profile
        </h1>
        <p className="text-[14px] text-ink-2 mt-2 leading-relaxed">
          Name, goals, dates joined, reassessment, and current scores will live here.
        </p>
      </div>
    </>
  )
}
