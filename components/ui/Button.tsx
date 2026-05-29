import type { ReactNode, ButtonHTMLAttributes } from 'react'
import Link from 'next/link'

type ButtonVariant = 'filled' | 'outline'
type ButtonSize = 'md' | 'sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  href?: string
  children: ReactNode
  className?: string
}

const base = 'inline-flex items-center justify-center font-medium transition-colors cursor-pointer'

const variants: Record<ButtonVariant, string> = {
  filled:  'bg-accent text-ink rounded-full hover:bg-[#ddd690] active:bg-[#d4cc88]',
  outline: 'bg-card text-ink border border-ink rounded-[10px] hover:bg-bg active:bg-accent',
}

const sizes: Record<ButtonSize, string> = {
  md: 'px-6 py-3 text-sm',
  sm: 'px-4 py-2 text-xs',
}

export function Button({
  variant = 'filled',
  size = 'md',
  href,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  )
}
