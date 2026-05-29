import { BrandHeader } from '@/components/ui/BrandHeader'

export default function ResourcesPage() {
  return (
    <>
      <BrandHeader />
      <div className="px-6 pt-5">
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1.5">Library</p>
        <h1 className="font-serif text-[28px] font-medium text-ink leading-snug">
          A library to return to, always.
        </h1>
        <p className="text-[14px] text-ink-2 mt-2 leading-relaxed">
          Read, listen, and ritual cards with type and duration badges will live here.
        </p>
      </div>
    </>
  )
}
