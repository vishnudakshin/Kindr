'use client'

import type { ReactNode } from 'react'
import { IconBubble } from './IconBubble'

interface SliderProps {
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  leftLabel: string
  rightLabel: string
  answerLabel: string
  icon: ReactNode
  className?: string
}

export function Slider({
  min,
  max,
  value,
  onChange,
  leftLabel,
  rightLabel,
  answerLabel,
  icon,
  className = '',
}: SliderProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <IconBubble>{icon}</IconBubble>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="flex justify-between items-baseline">
          <span className="text-[13px] font-medium text-ink">{answerLabel}</span>
          <span className="text-[11px] text-ink-2">{value} / {max}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="w-full cursor-pointer"
        />
        <div className="flex justify-between">
          <span className="text-[11px] text-ink-2">{leftLabel}</span>
          <span className="text-[11px] text-ink-2">{rightLabel}</span>
        </div>
      </div>
    </div>
  )
}
