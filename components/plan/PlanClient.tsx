'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconCircleCheck, IconCircle } from '@tabler/icons-react'
import { SaplingTree } from './SaplingTree'
import type { PlanItem, PlanCategory } from '@/lib/types'

// ── Filter config ─────────────────────────────────────────────────────────────

const FILTERS = ['All', 'Nutrition', 'Mind & Body', 'Fitness'] as const
type Filter = typeof FILTERS[number]

// ── Category colours ──────────────────────────────────────────────────────────

const CAT_STYLE: Record<PlanCategory, { bg: string; text: string }> = {
  'Nutrition':   { bg: '#E6F2DE', text: '#4A7A32' },
  'Mind & Body': { bg: '#E8E4F0', text: '#5A4880' },
  'Fitness':     { bg: '#DDE9F5', text: '#2A5A80' },
}

// ── Plan item card ────────────────────────────────────────────────────────────

function PlanItemCard({
  item,
  onToggle,
}: {
  item: PlanItem
  onToggle: () => void
}) {
  const cat = CAT_STYLE[item.category]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="bg-card rounded-2xl border border-border shadow-card p-4 flex items-start gap-3"
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className="shrink-0 mt-0.5 text-ink-2 hover:text-ink transition-colors"
        aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {item.completed
          ? <IconCircleCheck size={22} strokeWidth={1.5} className="text-ink" />
          : <IconCircle      size={22} strokeWidth={1.5} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span
          className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mb-1.5"
          style={{ background: cat.bg, color: cat.text }}
        >
          {item.category}
        </span>
        <p
          className={`text-[14px] font-medium text-ink leading-snug transition-opacity ${
            item.completed ? 'line-through opacity-40' : ''
          }`}
        >
          {item.title}
        </p>
        <p className="text-[12px] text-ink-2 mt-1 leading-relaxed">
          {item.description}
        </p>
      </div>
    </motion.div>
  )
}

// ── Completion message ────────────────────────────────────────────────────────

function completionCopy(done: number, total: number): string {
  if (done === 0)        return 'Ready when you are.'
  if (done === total)    return 'Everything done. Well done.'
  const pct = done / total
  if (pct >= 0.8)        return 'Almost there.'
  if (pct > 0.5)         return 'Keep going.'
  if (pct >= 0.5)        return 'Halfway through. Steady.'
  return `${done} of ${total} completed today.`
}

// ── Main client component ─────────────────────────────────────────────────────

export function PlanClient({ initialItems }: { initialItems: PlanItem[] }) {
  const [items, setItems]   = useState(initialItems)
  const [filter, setFilter] = useState<Filter>('All')

  function toggle(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, completed: !i.completed } : i))
  }

  const done  = items.filter(i => i.completed).length
  const total = items.length
  const pct   = total > 0 ? done / total : 0

  const filtered =
    filter === 'All' ? items : items.filter(i => i.category === filter)

  return (
    <>
      {/* ── Sapling + progress header ───────────────────────────── */}
      <div className="flex items-end gap-5 bg-bg-soft rounded-2xl border border-border p-5 mb-8">
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

          {/* Progress bar */}
          <div className="mt-3 h-1.5 rounded-full bg-border overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-ink"
              animate={{ width: `${pct * 100}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 22 }}
            />
          </div>
        </div>
      </div>

      {/* ── Filter pills ────────────────────────────────────────── */}
      <div
        className="flex gap-2 mb-6 -mx-1 px-1 overflow-x-auto pb-0.5"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors
              ${filter === f
                ? 'bg-ink text-card'
                : 'bg-card border border-border text-ink-2 hover:border-ink-2'
              }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ── Plan items list ──────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map(item => (
            <PlanItemCard
              key={item.id}
              item={item}
              onToggle={() => toggle(item.id)}
            />
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <p className="text-[13px] text-ink-2 text-center py-8">
            No items in this category yet.
          </p>
        )}
      </div>
    </>
  )
}
