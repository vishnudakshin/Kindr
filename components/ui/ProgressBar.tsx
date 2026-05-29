interface ProgressBarProps {
  value: number // 0–100
  className?: string
}

export function ProgressBar({ value, className = '' }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={`h-[3px] bg-accent rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-ink rounded-full transition-[width] duration-400 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
