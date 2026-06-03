'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { IconChevronDown, IconUpload, IconLoader2, IconCheck, IconX } from '@tabler/icons-react'
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

function mergeExtracted(
  panel: BloodPanel,
  extracted: Record<string, Record<string, string>>,
): { panel: BloodPanel; count: number } {
  const next = clonePanel(panel)
  let count = 0
  for (const [group, tests] of Object.entries(extracted)) {
    if (!next[group]) continue
    for (const [test, value] of Object.entries(tests)) {
      if (!next[group][test] || value === '') continue
      next[group][test] = { ...next[group][test], value }
      count++
    }
  }
  return { panel: next, count }
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

type ScanState = 'idle' | 'scanning' | 'done' | 'error'

export default function LabsPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [panel, setPanel] = useState<BloodPanel>(() => clonePanel(mockData.bloodPanel))
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [scanCount, setScanCount] = useState(0)
  const [scanError, setScanError] = useState<string | null>(null)

  function updateTest(group: string, test: string, value: string) {
    setPanel(prev => ({
      ...prev,
      [group]: { ...prev[group], [test]: { ...prev[group][test], value } },
    }))
  }

  async function handleFile(file: File) {
    setScanState('scanning')
    setScanError(null)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/ocr', { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok) {
        setScanError(json.error ?? 'Something went wrong. Please try again.')
        setScanState('error')
        return
      }

      const { panel: merged, count } = mergeExtracted(panel, json.extracted)
      setPanel(merged)
      setScanCount(count)
      setScanState('done')

      // Auto-expand groups that have pre-filled values so user can review them
      if (count > 0) {
        const firstFilledGroup = Object.keys(json.extracted)[0]
        // Scroll to the panel section
        document.getElementById('panel-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        void firstFilledGroup // suppress lint warning
      }
    } catch {
      setScanError('Network error. Check your connection and try again.')
      setScanState('error')
    }
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

        {/* Upload zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => scanState !== 'scanning' && fileRef.current?.click()}
          onKeyDown={e => e.key === 'Enter' && scanState !== 'scanning' && fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className={`border border-dashed rounded-2xl p-6 flex flex-col items-center gap-2 mb-3 text-center transition-colors
            ${scanState === 'scanning'
              ? 'border-border cursor-default opacity-70'
              : 'border-border cursor-pointer hover:bg-bg-soft'
            }`}
        >
          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center mb-1">
            {scanState === 'scanning'
              ? <IconLoader2 size={18} className="text-ink animate-spin" strokeWidth={1.5} />
              : <IconUpload size={18} className="text-ink" strokeWidth={1.5} />
            }
          </div>
          <p className="text-[13px] font-medium text-ink">
            {scanState === 'scanning' ? 'Reading your report…' : 'Upload your lab report'}
          </p>
          <p className="text-[11px] text-ink-2">
            {scanState === 'scanning'
              ? 'This usually takes a few seconds'
              : 'Drag & drop or click · PDF, JPG or PNG'}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
        </div>

        {/* Success banner */}
        {scanState === 'done' && (
          <div className="flex items-start gap-3 bg-bg border border-border rounded-xl px-4 py-3 mb-4">
            <div className="w-5 h-5 rounded-full bg-ink flex items-center justify-center shrink-0 mt-0.5">
              <IconCheck size={12} className="text-bg" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-medium text-ink">
                {scanCount} value{scanCount !== 1 ? 's' : ''} extracted
              </p>
              <p className="text-[11px] text-ink-2 mt-0.5">
                Review and edit everything below before saving — you're always in control.
              </p>
            </div>
            <button onClick={() => setScanState('idle')} className="text-ink-2 hover:text-ink cursor-pointer shrink-0">
              <IconX size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* Error banner */}
        {scanState === 'error' && scanError && (
          <div className="flex items-start gap-3 bg-bg border border-border rounded-xl px-4 py-3 mb-4">
            <p className="text-[12px] text-ink-2 flex-1">{scanError}</p>
            <button onClick={() => setScanState('idle')} className="text-ink-2 hover:text-ink cursor-pointer shrink-0">
              <IconX size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}

        <p id="panel-section" className="text-[11px] tracking-[.07em] uppercase text-ink-2 mb-3 mt-6">
          {scanState === 'done' ? 'Review & edit your values' : 'Or enter manually'}
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
