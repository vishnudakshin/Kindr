import { IconLeaf, IconClock, IconFileText, IconSparkles } from '@tabler/icons-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { IconBubble } from '@/components/ui/IconBubble'

const steps = [
  {
    Icon: IconClock,
    title: 'A 10-minute discovery',
    description: 'Short, thoughtful questions about your goals, sleep, energy and movement.',
  },
  {
    Icon: IconFileText,
    title: 'Add your health story (optional)',
    description: 'Upload blood panels or reports later for deeper, biologically-informed insights.',
  },
  {
    Icon: IconSparkles,
    title: 'Your personalised plan',
    description: 'We translate your answers into a wellness plan tuned to your unique needs.',
  },
]

export default function WelcomePage() {
  return (
    <main className="min-h-screen bg-bg flex flex-col px-6 pt-8 pb-12 max-w-lg mx-auto">
      <header className="flex items-center gap-[7px] mb-14">
        <span className="font-serif text-[32px] font-medium text-ink leading-none">Kindr.</span>
        <IconLeaf size={14} className="text-ink-2" aria-hidden />
      </header>

      <section className="mb-10">
        <p className="text-[11px] tracking-[.14em] uppercase text-ink-2 mb-3">Welcome</p>
        <h1 className="font-serif text-[40px] leading-[1.15] font-medium text-ink mb-5">
          Let's begin gently.
        </h1>
        <p className="text-[15px] text-ink-2 leading-relaxed max-w-[380px]">
          Before we craft your plan, we'd love to understand you a little better.
          Think of this as a quiet conversation, not a medical form.
        </p>
      </section>

      <div className="flex flex-col gap-4 mb-14">
        {steps.map(({ Icon, title, description }) => (
          <Card key={title} className="flex items-start gap-4">
            <IconBubble className="bg-accent border-accent shrink-0">
              <Icon size={18} className="text-ink" strokeWidth={1.5} />
            </IconBubble>
            <div>
              <p className="font-sans text-[14px] font-medium text-ink mb-1">{title}</p>
              <p className="font-sans text-[12px] text-ink-2 leading-relaxed">{description}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button href="/questionnaire" variant="filled" size="md" className="px-8 py-3.5">
          I'm ready
        </Button>
      </div>
    </main>
  )
}
