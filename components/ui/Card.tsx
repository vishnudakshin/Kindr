import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`bg-card rounded-2xl border border-border shadow-card p-5 ${className}`}
    >
      {children}
    </div>
  )
}
