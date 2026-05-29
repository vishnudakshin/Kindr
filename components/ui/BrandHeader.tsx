'use client'

import { IconLeaf } from '@tabler/icons-react'

interface BrandHeaderProps {
  stepLabel?: string
  className?: string
}

export function BrandHeader({ stepLabel, className = '' }: BrandHeaderProps) {
  return (
    <div className={`flex items-center justify-between px-6 pt-5 pb-0 ${className}`}>
      <div className="flex items-center gap-[7px]">
        <span className="font-serif text-[18px] font-medium text-ink leading-none">Kindr.</span>
        <IconLeaf size={15} className="text-ink-2" aria-hidden />
      </div>
      {stepLabel && (
        <span className="text-[12px] text-ink-2">{stepLabel}</span>
      )}
    </div>
  )
}
