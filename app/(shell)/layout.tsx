'use client'

import Link from 'next/link'
import { IconChevronLeft } from '@tabler/icons-react'
import { TabBar } from '@/components/TabBar'
import { useUserContext } from '@/lib/UserContext'

function PatientBanner() {
  const { users, activeUserId } = useUserContext()
  if (!activeUserId) return null
  const patient = users.find(u => u.id === activeUserId)
  if (!patient) return null

  return (
    <div className="bg-ink flex items-center gap-2 px-4 py-2 shrink-0">
      <Link
        href="/patients"
        className="flex items-center gap-1 text-[11px] text-[rgba(245,240,208,0.6)] hover:text-[#F5F0D0] transition-colors"
      >
        <IconChevronLeft size={12} strokeWidth={2} />
        All patients
      </Link>
      <span className="text-[rgba(245,240,208,0.3)] text-[11px]">·</span>
      <span className="text-[11px] text-[#F5F0D0] font-medium truncate">{patient.name}</span>
    </div>
  )
}

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <PatientBanner />
      <main className="flex-1 pb-[68px]">{children}</main>
      <TabBar />
    </div>
  )
}
