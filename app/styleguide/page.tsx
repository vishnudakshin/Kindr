'use client'

import { useState } from 'react'
import {
  IconBrain,
  IconMoon,
  IconFlame,
  IconLeaf,
  IconDroplet,
  IconBolt,
  IconHeart,
  IconMoodHappy,
  IconMoodSmile,
  IconMoodNeutral,
  IconMoodSad,
  IconRun,
} from '@tabler/icons-react'
import { BrandHeader } from '@/components/ui/BrandHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Pill } from '@/components/ui/Pill'
import { IconBubble } from '@/components/ui/IconBubble'
import { Slider } from '@/components/ui/Slider'
import { ProgressBar } from '@/components/ui/ProgressBar'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <p className="text-[10px] tracking-[.12em] uppercase text-ink-2 mb-4 font-sans">{title}</p>
      {children}
    </section>
  )
}

function Swatch({ token, hex, textDark = true }: { token: string; hex: string; textDark?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 w-[80px]">
      <div
        className="h-10 rounded-xl border border-border"
        style={{ background: hex }}
      />
      <p className={`text-[10px] font-mono ${textDark ? 'text-ink' : 'text-ink-2'}`}>{token}</p>
      <p className="text-[10px] font-mono text-ink-2">{hex}</p>
    </div>
  )
}

const STRESS_ICONS = [IconMoodHappy, IconMoodSmile, IconMoodNeutral, IconMoodSad, IconMoodSad]
const STRESS_LABELS = ['Never', 'Rarely', 'Occasionally', 'Quite often', 'Very often']

export default function StyleguidePage() {
  const [sliderValue, setSliderValue] = useState(2)
  const [activePill, setActivePill] = useState('All')

  const StressIcon = STRESS_ICONS[sliderValue - 1]

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <BrandHeader />

      <div className="px-6 pt-8 pb-24 max-w-lg mx-auto">
        <h1 className="font-serif text-[30px] font-medium text-ink leading-tight mb-1">
          Styleguide
        </h1>
        <p className="text-[13px] text-ink-2 mb-10">Kindr. design primitives · v0.1</p>

        {/* ── PALETTE ── */}
        <Section title="Palette">
          <div className="flex flex-wrap gap-3">
            <Swatch token="--bg"       hex="#F5F0D0" />
            <Swatch token="--bg-soft"  hex="#FAF6E3" />
            <Swatch token="--accent"   hex="#E8E0A0" />
            <Swatch token="--ink"      hex="#2C2A1E" textDark={false} />
            <Swatch token="--ink-2"    hex="#6B6650" textDark={false} />
            <Swatch token="--card"     hex="#FFFFFF" />
            <Swatch token="--border"   hex="#D8D0A8" />
          </div>
        </Section>

        {/* ── TYPOGRAPHY ── */}
        <Section title="Typography">
          <div className="space-y-3">
            <p className="font-serif text-[36px] leading-tight font-medium text-ink">
              Wellness, designed for you.
            </p>
            <p className="font-serif text-[24px] leading-snug font-medium text-ink">
              Let's begin gently.
            </p>
            <p className="font-serif text-[19px] leading-snug font-medium text-ink">
              How has stress been showing up lately?
            </p>
            <p className="font-sans text-[15px] text-ink leading-relaxed">
              Body copy — Inter. A quiet, personalised journey through nutrition,
              movement, sleep, and mind — grounded in your blood chemistry.
            </p>
            <p className="font-sans text-[13px] text-ink-2 leading-relaxed">
              Secondary / hint — No judgement. Think of this as a quiet conversation,
              not a medical form.
            </p>
            <p className="font-sans text-[11px] tracking-widest uppercase text-ink-2">
              Step label · Category
            </p>
          </div>
        </Section>

        {/* ── BRAND HEADER ── */}
        <Section title="BrandHeader">
          <div className="space-y-3">
            <div className="bg-bg-soft rounded-2xl overflow-hidden border border-border">
              <BrandHeader />
              <p className="text-[11px] text-ink-2 px-6 pb-3 pt-1">Without step counter</p>
            </div>
            <div className="bg-bg-soft rounded-2xl overflow-hidden border border-border">
              <BrandHeader stepLabel="Step 3 of 7" />
              <p className="text-[11px] text-ink-2 px-6 pb-3 pt-1">With step counter</p>
            </div>
          </div>
        </Section>

        {/* ── BUTTONS ── */}
        <Section title="Button">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <Button variant="filled" size="md">I'm ready</Button>
              <Button variant="filled" size="sm">Begin</Button>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Button variant="outline" size="md">Back</Button>
              <Button variant="outline" size="sm">Skip</Button>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Button variant="filled" href="/welcome">Link → /welcome</Button>
            </div>
          </div>
        </Section>

        {/* ── CARD ── */}
        <Section title="Card">
          <div className="space-y-3">
            <Card>
              <p className="font-sans text-[14px] font-medium text-ink mb-1">
                How often have you felt unable to control important things in your life?
              </p>
              <p className="font-sans text-[12px] text-ink-2">
                Think about the past month and select what feels most true.
              </p>
            </Card>
            <Card className="flex items-start gap-3">
              <IconBubble>
                <IconBolt size={20} className="text-ink" />
              </IconBubble>
              <div>
                <p className="font-sans text-[13px] font-medium text-ink">Low energy</p>
                <p className="font-sans text-[11px] text-ink-2">Fatigue, sluggishness</p>
              </div>
            </Card>
          </div>
        </Section>

        {/* ── PILL ── */}
        <Section title="Pill">
          <div className="flex flex-wrap gap-2">
            {['All', 'Nutrition', 'Mind & Body', 'Fitness'].map((label) => (
              <Pill
                key={label}
                active={activePill === label}
                onClick={() => setActivePill(label)}
              >
                {label}
              </Pill>
            ))}
          </div>
          <p className="text-[11px] text-ink-2 mt-2">Click to toggle active state</p>
        </Section>

        {/* ── ICON BUBBLE ── */}
        <Section title="IconBubble">
          <div className="flex flex-wrap gap-3">
            {[
              { Icon: IconBrain,   label: 'brain'   },
              { Icon: IconMoon,    label: 'moon'    },
              { Icon: IconFlame,   label: 'flame'   },
              { Icon: IconLeaf,    label: 'leaf'    },
              { Icon: IconDroplet, label: 'droplet' },
              { Icon: IconHeart,   label: 'heart'   },
              { Icon: IconRun,     label: 'run'     },
            ].map(({ Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <IconBubble>
                  <Icon size={20} className="text-ink" />
                </IconBubble>
                <span className="text-[10px] text-ink-2">{label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── SLIDER ── */}
        <Section title="Slider (interactive)">
          <Card>
            <p className="font-sans text-[14px] font-medium text-ink mb-3">
              How often have you felt confident handling personal problems?
            </p>
            <Slider
              min={1}
              max={5}
              value={sliderValue}
              onChange={setSliderValue}
              leftLabel="Never"
              rightLabel="Very often"
              answerLabel={STRESS_LABELS[sliderValue - 1]}
              icon={<StressIcon size={20} className="text-ink" />}
            />
          </Card>
          <p className="text-[11px] text-ink-2 mt-2">Drag to see icon + label update</p>
        </Section>

        {/* ── PROGRESS BAR ── */}
        <Section title="ProgressBar">
          <div className="space-y-4">
            {[14, 43, 71, 100].map((pct) => (
              <div key={pct} className="space-y-1.5">
                <ProgressBar value={pct} />
                <p className="text-[10px] text-ink-2 font-mono">{pct}%</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── CHOICE BUTTONS ── */}
        <Section title="Choice buttons (single-select)">
          <ChoiceDemo />
        </Section>
      </div>
    </div>
  )
}

function ChoiceDemo() {
  const [selected, setSelected] = useState('Rarely')
  const options = ['Rarely', '1–2x / week', '3–4x / week', 'Almost nightly']
  return (
    <Card>
      <p className="font-sans text-[14px] font-medium text-ink mb-3">
        How often do you wake during the night?
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => setSelected(opt)}
            className={`
              border rounded-[20px] px-3 py-1.5 text-[12px] cursor-pointer transition-colors
              ${selected === opt
                ? 'bg-bg border-ink text-ink'
                : 'bg-card border-ink text-ink hover:bg-bg'
              }
            `}
          >
            {opt}
          </button>
        ))}
      </div>
    </Card>
  )
}
