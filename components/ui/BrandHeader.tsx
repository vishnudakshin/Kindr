'use client'

import Link from 'next/link'
import { IconLeaf } from '@tabler/icons-react'

interface BrandHeaderProps {
  stepLabel?: string
  className?: string
  /** When set, the Kindr. logo becomes a link (shell pages pass href="/"). */
  href?: string
}

export function BrandHeader({ stepLabel, className = '', href }: BrandHeaderProps) {
  const logo = (
    <div className="flex items-center gap-[7px]">
      <span className="font-serif text-[18px] font-medium text-ink leading-none">Kindr.</span>
      <IconLeaf size={15} className="text-ink-2" aria-hidden />
    </div>
  )

  return (
    <div className={`flex items-center justify-between px-6 pt-5 pb-0 ${className}`}>
      {href ? (
        <Link href={href} className="hover:opacity-70 transition-opacity">
          {logo}
        </Link>
      ) : (
        logo
      )}
      {stepLabel && (
        <span className="text-[12px] text-ink-2">{stepLabel}</span>
      )}
    </div>
  )
}
