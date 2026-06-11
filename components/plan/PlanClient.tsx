'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconCircleCheck, IconCircle, IconChevronDown } from '@tabler/icons-react'
import { SaplingTree } from './SaplingTree'
import type { DailyPlan, PlanTask } from '@/lib/data'

type PlanCategory = 'Nourish' | 'Calm' | 'Move'

// ── Category colours ──────────────────────────────────────────────────────────

const CAT_STYLE: Record<PlanCategory, { bg: string; text: string }> = {
  Nourish: { bg: '#E6F2DE', text: '#4A7A32' },  // sage green
  Calm:    { bg: '#E8E4F0', text: '#5A4880' },  // slate/lavender
  Move:    { bg: '#F3E6CD', text: '#7e5a1f' },  // amber/ochre
}

const FILTERS = ['All', 'Nourish', 'Calm', 'Move'] as const
type Filter = typeof FILTERS[number]

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  completed,
  onToggle,
}: {
  task: PlanTask
  completed: boolean
  onToggle: () => void
}) {
  const [showEvidence, setShowEvidence] = useState(false)
  const cat = CAT_STYLE[task.category]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="bg-card rounded-2xl border border-border shadow-card p-4"
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className="shrink-0 mt-0.5 text-ink-2 hover:text-ink transition-colors"
          aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {completed
            ? <IconCircleCheck size={22} strokeWidth={1.5} className="text-ink" />
            : <IconCircle      size={22} strokeWidth={1.5} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <span
            className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1.5"
            style={{ background: cat.bg, color: cat.text }}
          >
            {task.category}
          </span>

          <p className={`text-[14px] font-medium text-ink leading-snug transition-opacity ${
            completed ? 'line-through opacity-40' : ''
          }`}>
            {task.title}
          </p>

          <p className="text-[12px] text-ink-2 mt-1 leading-relaxed">
            {task.detail}
          </p>

          {/* Evidence toggle */}
          <button
            onClick={() => setShowEvidence(v => !v)}
            className="flex items-center gap-1 mt-2 text-[11px] font-medium text-ink-2 hover:text-ink transition-colors"
          >
            Why this works
            <IconChevronDown
              size={12}
              strokeWidth={2}
              className={`transition-transform duration-200 ${showEvidence ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {showEvidence && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="text-[11px] text-ink-2 italic leading-relaxed mt-1.5 border-l-2 border-accent pl-2 overflow-hidden"
              >
                {task.evidence}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

// ── Completion copy ───────────────────────────────────────────────────────────

function completionCopy(done: number, total: number): string {
  if (done === 0)     return 'Ready when you are.'
  if (done === total) return 'Everything done. Well done.'
  const pct = done / total
  if (pct >= 0.8)     return 'Almost there.'
  if (pct >= 0.5)     return 'Keep going.'
  return `${done} of ${total} completed today.`
}

// ── Main client component ─────────────────────────────────────────────────────

export function PlanClient({ plan }: { plan: DailyPlan }) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<Filter>('All')

  function toggle(id: string) {
    setCompletedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const done  = completedIds.size
  const total = plan.total
  const pct   = total > 0 ? done / total : 0

  const visible = filter === 'All'
    ? plan.tasks
    : plan.tasks.filter(t => t.category === filter)

  return (
    <>
      {/* ── Sapling + progress ──────────────────────────── */}
      <div className="flex items-end gap-5 bg-bg-soft rounded-2xl border border-border p-5 mb-6">
        <div className="w-28 h-28 shrink-0">
          <SaplingTree pct={pct} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-[36px] font-medium text-ink leading-none">
            {done}
            <span className="text-[20px] text-ink-2 font-normal">/{total}</span>
          </p>
          <p className="text-[13px] text-ink-2 mt-1 leading-relaxed">
            {completionCopy(done, total)}
          </p>
          <div className="mt-3 h-1.5 rounded-full bg-border overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-ink"
              animate={{ width: `${pct * 100}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 22 }}
            />
          </div>
        </div>
      </div>

      {/* ── Filter pills ──────────────────────────────── */}
      <div
        className="flex gap-2 mb-5 -mx-1 px-1 overflow-x-auto pb-0.5"
        style={{ scrollbarWidth: 'none' } as React.CSSProperties}
      >
        {FILTERS.map(f => {
          const isActive = filter === f
          const style = f !== 'All' ? CAT_STYLE[f as PlanCategory] : null
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors"
              style={
                isActive && style
                  ? { background: style.bg, color: style.text, border: `1.5px solid ${style.bg}` }
                  : isActive
                  ? { background: '#2C2A1E', color: '#F5F0D0', border: '1.5px solid #2C2A1E' }
                  : { background: '#FFFFFF', color: '#6B6650', border: '1.5px solid #D8D0A8' }
              }
            >
              {f}
            </button>
          )
        })}
      </div>

      {/* ── Task cards ────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {visible.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              completed={completedIds.has(task.id)}
              onToggle={() => toggle(task.id)}
            />
          ))}
        </AnimatePresence>

        {visible.length === 0 && (
          <p className="text-[13px] text-ink-2 text-center py-8">
            No tasks in this category.
          </p>
        )}
      </div>
    </>
  )
}
