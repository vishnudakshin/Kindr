'use client'

import { useRouter } from 'next/navigation'
import { IconShare2 } from '@tabler/icons-react'

interface Props {
  variant?: 'primary' | 'secondary'
  className?: string
}

export function ShareReportButton({ variant = 'primary', className = '' }: Props) {
  const router = useRouter()

  if (variant === 'secondary') {
    return (
      <button
        onClick={() => router.push('/share-report')}
        className={`flex items-center gap-2 px-4 py-2 rounded-full border border-border text-ink text-[13px] font-medium hover:bg-bg-soft transition-colors ${className}`}
      >
        <IconShare2 size={15} strokeWidth={1.8} />
        Share my report
      </button>
    )
  }

  return (
    <button
      onClick={() => router.push('/share-report')}
      className={`flex items-center gap-2 w-full justify-center py-3 rounded-full bg-accent text-ink text-[13px] font-medium hover:bg-[#ddd690] transition-colors ${className}`}
    >
      <IconShare2 size={15} strokeWidth={1.8} />
      Share my report
    </button>
  )
}
