'use client'

import { motion, AnimatePresence } from 'framer-motion'

const SPRING = { type: 'spring' as const, stiffness: 80, damping: 18 }

// ── Mini tree SVG (viewBox 22×28) ─────────────────────────────────────────────

function MiniTree({ stage }: { stage: number }) {
  if (stage === 0) return (
    <svg viewBox="0 0 22 28" fill="none" className="w-full h-full">
      <ellipse cx="11" cy="24" rx="7.5" ry="2.8" fill="#C0A060" opacity="0.65"/>
      <ellipse cx="11" cy="22.5" rx="4.5" ry="1.5" fill="#B09050" opacity="0.4"/>
    </svg>
  )

  if (stage === 1) return (
    <svg viewBox="0 0 22 28" fill="none" className="w-full h-full">
      <ellipse cx="11" cy="25" rx="5.5" ry="2" fill="#C0A060" opacity="0.45"/>
      <line x1="11" y1="25" x2="11" y2="15" stroke="#7A9848" strokeWidth="1.3" strokeLinecap="round"/>
      <ellipse cx="8" cy="16" rx="4.2" ry="2.2" fill="#82B268" transform="rotate(-28 8 16)"/>
      <ellipse cx="14" cy="16" rx="4.2" ry="2.2" fill="#82B268" transform="rotate(28 14 16)"/>
      <ellipse cx="11" cy="13" rx="2.5" ry="3.8" fill="#8EC264"/>
    </svg>
  )

  if (stage === 2) return (
    <svg viewBox="0 0 22 28" fill="none" className="w-full h-full">
      <path d="M10,26 C10,20 10.5,15 11,11 L12,11 C12.5,15 13,20 13,26 Z" fill="#A07845"/>
      <circle cx="11" cy="10.5" r="5.5" fill="#5C9645"/>
      <circle cx="7"  cy="12.5" r="3.5" fill="#5C9645"/>
      <circle cx="15" cy="12.5" r="3.5" fill="#5C9645"/>
      <circle cx="11" cy="7"   r="4"   fill="#7AB855"/>
      <circle cx="9"  cy="8"   r="2"   fill="#90C060" opacity="0.5"/>
    </svg>
  )

  if (stage === 3) return (
    <svg viewBox="0 0 22 28" fill="none" className="w-full h-full">
      <path d="M9.5,26 C9,20 9,13 10,8 L12,8 C13,13 13,20 12.5,26 Z" fill="#8B6030"/>
      <circle cx="11" cy="10" r="5"   fill="#3E7832" opacity="0.9"/>
      <circle cx="6.5" cy="12" r="4" fill="#3E7832" opacity="0.85"/>
      <circle cx="15.5" cy="12" r="4" fill="#3E7832" opacity="0.85"/>
      <circle cx="11" cy="6.5" r="5.5" fill="#5C9645"/>
      <circle cx="7.5" cy="7.5" r="3"  fill="#7AB855" opacity="0.7"/>
      <circle cx="14.5" cy="7.5" r="3" fill="#7AB855" opacity="0.65"/>
      <circle cx="11" cy="3.5" r="3.5" fill="#90C060" opacity="0.8"/>
    </svg>
  )

  // stage 4 — full oak
  return (
    <svg viewBox="0 0 22 28" fill="none" className="w-full h-full">
      <path d="M9,26 C8.5,20 8.5,13 9.5,9 L12.5,9 C13.5,13 13.5,20 13,26 Z" fill="#6B3A18"/>
      <line x1="9.5"  y1="11" x2="5.5"  y2="7.5" stroke="#5A3015" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="12.5" y1="11" x2="16.5" y2="7.5" stroke="#5A3015" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="2.5"  cy="11"  r="4"   fill="#1E4A10"/>
      <circle cx="19.5" cy="11"  r="4"   fill="#1E4A10"/>
      <circle cx="11"   cy="11"  r="6"   fill="#326820"/>
      <circle cx="5"    cy="9"   r="4.5" fill="#3A7222"/>
      <circle cx="17"   cy="9"   r="4.5" fill="#3A7222"/>
      <circle cx="11"   cy="6.5" r="5.5" fill="#4E9030"/>
      <circle cx="7"    cy="5"   r="3.5" fill="#72B835"/>
      <circle cx="15"   cy="5"   r="3.5" fill="#72B835"/>
      <circle cx="11"   cy="2.5" r="4"   fill="#94CC38"/>
      <circle cx="9"    cy="1"   r="2.5" fill="#C0E840" opacity="0.8"/>
      <circle cx="13"   cy="1"   r="2.5" fill="#C0E840" opacity="0.8"/>
    </svg>
  )
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  date: string
  tasksCompleted?: number
  tasksTotal?: number
  isFuture?: boolean
  isActive?: boolean
  onActivate?: () => void
  delay?: number
}

export function ForestTreeSpot({
  date,
  tasksCompleted = 0,
  tasksTotal = 10,
  isFuture = false,
  isActive = false,
  onActivate,
  delay = 0,
}: Props) {
  const pct = tasksCompleted / tasksTotal

  const stage = isFuture ? -1 :
    pct >= 1.0 ? 4 :
    pct >= 0.7 ? 3 :
    pct >= 0.4 ? 2 :
    pct >  0   ? 1 :
    0

  return (
    <motion.div
      className="relative flex items-center justify-center cursor-pointer"
      style={{ width: 22, height: 28 }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: isFuture ? 0.3 : 1, scale: 1 }}
      transition={{ ...SPRING, delay }}
      onClick={isFuture ? undefined : onActivate}
    >
      {isFuture ? (
        <div className="w-2 h-2 rounded-full bg-border" />
      ) : (
        <MiniTree stage={stage} />
      )}

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.92 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 bg-ink rounded-lg px-2.5 py-1.5 whitespace-nowrap pointer-events-none shadow-md"
          >
            <p className="text-[10px] font-medium text-[#F5F0D0] leading-tight">{fmtDate(date)}</p>
            <p className="text-[9px] text-[#C8BA82] mt-0.5">{tasksCompleted}/{tasksTotal} done</p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0" style={{
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: '4px solid #2C2A1E',
            }}/>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
