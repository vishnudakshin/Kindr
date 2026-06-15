'use client'

import {
  IconBook2, IconHeadphones, IconSparkles,
  IconSun, IconMoon, IconWind, IconChartBar, IconRun, IconMoonStars,
} from '@tabler/icons-react'
import type { FC } from 'react'
import { BrandHeader } from '@/components/ui/BrandHeader'
import { mockData } from '@/lib/data'
import type { Resource, ResourceType } from '@/lib/types'

// ── Icon maps ─────────────────────────────────────────────────────────────────

type TablerIcon = FC<{ size?: number; strokeWidth?: number; className?: string }>

const TYPE_ICON: Record<ResourceType, TablerIcon> = {
  READ:   IconBook2,
  LISTEN: IconHeadphones,
  RITUAL: IconSparkles,
}

const TYPE_LABEL: Record<ResourceType, string> = {
  READ:   'Read',
  LISTEN: 'Listen',
  RITUAL: 'Ritual',
}

const CONTENT_ICON: Record<string, TablerIcon> = {
  sun:        IconSun,
  moon:       IconMoon,
  wind:       IconWind,
  'chart-line': IconChartBar,
  run:        IconRun,
  'moon-stars': IconMoonStars,
}

// ── Resource card ─────────────────────────────────────────────────────────────

function ResourceCard({ resource }: { resource: Resource }) {
  const TypeIcon    = TYPE_ICON[resource.type]
  const ContentIcon = CONTENT_ICON[resource.iconName] ?? IconBook2

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-5 flex flex-col gap-3">
      {/* Icon bubble */}
      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center self-start">
        <ContentIcon size={17} strokeWidth={1.5} className="text-ink" />
      </div>

      {/* Badge row */}
      <div className="flex items-center gap-1.5">
        <TypeIcon size={11} strokeWidth={2} className="text-ink-2" />
        <p className="text-[10px] tracking-[.10em] uppercase text-ink-2 font-medium">
          {TYPE_LABEL[resource.type]} · {resource.duration}
        </p>
      </div>

      {/* Title + description */}
      <div>
        <h3 className="font-serif text-[17px] font-medium text-ink leading-snug">
          {resource.title}
        </h3>
        <p className="text-[12px] text-ink-2 mt-1.5 leading-relaxed">
          {resource.description}
        </p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const { resources } = mockData

  return (
    <>
      <BrandHeader />
      <div className="px-6 pt-4 pb-10">
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-3">Resources</p>
        <h1 className="font-serif text-[32px] font-medium text-ink leading-snug mb-8">
          A library to return to, always.
        </h1>

        <div className="flex flex-col gap-4">
          {resources.map(r => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      </div>
    </>
  )
}
