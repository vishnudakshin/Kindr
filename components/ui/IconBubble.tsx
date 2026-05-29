import type { ReactNode } from 'react'

interface IconBubbleProps {
  children: ReactNode
  className?: string
}

export function IconBubble({ children, className = '' }: IconBubbleProps) {
  return (
    <div
      className={`w-[42px] h-[42px] rounded-full bg-bg border border-border flex items-center justify-center shrink-0 ${className}`}
    >
      {children}
    </div>
  )
}
