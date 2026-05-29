'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { IconChevronDown, IconUpload } from '@tabler/icons-react'
import { BrandHeader } from '@/components/ui/BrandHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { mockData, saveBloodPanel } from '@/lib/data'
import type { BloodPanel, BloodTestResult } from '@/lib/types'

function clonePanel(p: BloodPanel): BloodPanel {
  return Object.fromEntries(
    Object.entries(p).map(([g, tests]) => [
      g,
      Object.fromEntries(Object.entries(tests).map(([t, r]) => [t, { ...r }])),
    ])
  )
}

function TestRow({
  name,
  result,
  onChange,
}: {
  name: string
  result: BloodTestResult
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-ink">{name}</p>
        <p className="text-[11px] text-ink-2 mt-0.5">ref {result.refRange}</p>
      </div>
      <div className="flex items-baseline gap-1.5 shrink-0">
        <input
          type="text"
          inputMode="decimal"
          value={result.value}
          onChange={e => onChange(e.target.value)}
          placeholder="—"
          className="w-14 text-right text-[13px] text-ink bg-transparent border-b border-ink-2 focus:border-ink outline-none pb-0.5 placeholder:text-ink-2 transition-colors"
        />
        {result.unit && (
          <span className="text-[11px] text-ink-2 w-12">{result.unit}</span>
        )}
      </div>
    </div>
  )
}

function GroupSection({
  name,
  tests,
  onUpdate,
}: {
  name: string
  tests: Record<string, BloodTestResult>
  onUpdate: (test: string, value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const count = Object.keys(tests).length

  return (
    <Card className="mb-3 !p-0 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer"
      >
        <div>
          <p className="text-[14px] font-medium text-ink">{name}</p>
          <p className="text-[11px] text-ink-2 mt-0.5">{count} {count === 1 ? 'test' : 'tests'}</p>
        </div>
        <IconChevronDown
          size={18}
          strokeWidth={1.5}
          className={`text-ink-2 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-5 pb-4">
          {Object.entries(tests).map(([testName, result]) => (
            <TestRow
              key={testName}
              name={testName}
              result={result}
              onChange={v => onUpdate(testName, v)}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

export default function LabsPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [panel, setPanel] = useState<BloodPanel>(() => clonePanel(mockData.bloodPanel))
  const [ocrNote, setOcrNote] = useState<string | null>(null)

  function updateTest(group: string, test: string, value: string) {
    setPanel(prev => ({
      ...prev,
      [group]: {
        ...prev[group],
        [test]: { ...prev[group][test], value },
      },
    }))
  }

  function handleFile(file: File) {
    setOcrNote(`"${file.name}" received. OCR processing is coming soon — please enter values manually for now.`)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleSave() {
    saveBloodPanel(panel)
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      <BrandHeader />

      <div className="px-6 pt-5">
        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-1.5">Blood panel</p>
        <h1 className="font-serif text-[28px] font-medium text-ink leading-snug mb-2">
          Add your health story.
        </h1>
        <p className="text-[14px] text-ink-2 leading-relaxed mb-6">
          Enter what you have — skip anything you don't. Your plan works without
          lab data, and you can{' '}
          <button
            onClick={() => router.push('/dashboard')}
            className="underline underline-offset-2 cursor-pointer"
          >
            skip for now
          </button>
          {' '}and add more later.
        </p>

        {/* Upload stub */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="border border-dashed border-border rounded-2xl p-6 flex flex-col items-center gap-2 mb-2 cursor-pointer hover:bg-bg-soft transition-colors text-center"
        >
          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center mb-1">
            <IconUpload size={18} className="text-ink" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] font-medium text-ink">Upload your lab report</p>
          <p className="text-[11px] text-ink-2">Drag & drop or click · PDF, JPG or PNG</p>
          <p className="text-[10px] text-ink-2 opacity-70">OCR extraction coming soon</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
        </div>

        {ocrNote && (
          <div className="bg-bg-soft border border-border rounded-xl px-4 py-3 mb-4">
            <p className="text-[12px] text-ink-2">{ocrNote}</p>
          </div>
        )}

        <p className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-3 mt-6">
          Or enter manually
        </p>

        {Object.entries(panel).map(([group, tests]) => (
          <GroupSection
            key={group}
            name={group}
            tests={tests}
            onUpdate={(test, value) => updateTest(group, test, value)}
          />
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-bg border-t border-border px-6 py-4 flex gap-3">
        <Button variant="outline" href="/questionnaire">Back</Button>
        <Button variant="filled" className="flex-1" onClick={handleSave}>
          Save & continue
        </Button>
      </div>
    </div>
  )
}
