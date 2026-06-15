import Link from 'next/link'
import { IconLeaf, IconSparkles, IconSeedling, IconMoon, IconWind, IconUsers } from '@tabler/icons-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const features = [
  { Icon: IconSeedling, title: 'Nourish',  description: 'Functional nutrition tuned to your biology.'    },
  { Icon: IconMoon,     title: 'Calm',     description: 'Mind-body practices to soften daily stress.'    },
  { Icon: IconWind,     title: 'Move',     description: 'Movement that meets you where you are.'          },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-bg flex flex-col">
      <header className="flex items-center justify-between px-6 pt-8 pb-0">
        <div className="flex items-center gap-[7px]">
          <span className="font-serif text-[32px] font-medium text-ink leading-none">Kindr.</span>
          <IconLeaf size={16} className="text-ink-2" aria-hidden />
        </div>
        <Link
          href="/patients"
          className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2 hover:text-ink transition-colors"
        >
          <IconUsers size={14} strokeWidth={1.5} />
          User list
        </Link>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-1 pb-1">
        <div className="inline-flex items-center gap-1.5 bg-bg-soft border border-border rounded-full px-3.5 py-1.5 mb-5">
          <IconSparkles size={13} className="text-ink-2" />
          <span className="text-[12px] text-ink-2">A gentler way to feel well</span>
        </div>

        <h1 className="font-serif text-[48px] leading-[1.15] font-medium text-ink mb-5 max-w-[620px]">
          Wellness, designed for <em>you</em>.
        </h1>

        <p className="text-[15px] text-ink-2 leading-relaxed mb-10 max-w-[520px]">
          Kindr. blends functional nutrition, mind-body therapy and movement with your own
          health data — to design a wellness plan as unique as you are.
        </p>

        <Button href="/welcome" variant="filled" size="md" className="px-8 py-3.5">
          Begin your journey
        </Button>
      </section>

      <section className="px-6 pb-12 max-w-2xl mx-auto w-full">
        <div className="grid grid-cols-3 gap-4">
          {features.map(({ Icon, title, description }) => (
            <Card key={title} className="flex flex-col gap-3 p-5">
              <Icon size={18} className="text-ink-2" strokeWidth={1.5} />
              <div>
                <p className="font-sans text-[14px] font-medium text-ink mb-1">{title}</p>
                <p className="font-sans text-[12px] text-ink-2 leading-relaxed">{description}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}
