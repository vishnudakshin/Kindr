'use client'

import type { ReactNode } from 'react'

interface PillProps {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
}

export function Pill({ children, active = false, onClick, className = '' }: PillProps) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center px-4 py-1.5 rounded-full text-xs font-medium
        border transition-colors cursor-pointer
        ${active
          ? 'bg-ink text-bg border-ink'
          : 'bg-card text-ink border-border hover:bg-bg'
        }
        ${className}
      `}
    >
      {children}
    </button>
  )
}
