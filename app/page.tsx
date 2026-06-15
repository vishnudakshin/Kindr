'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getActiveUserId } from '@/lib/storage'

// Root redirects: active patient → dashboard, no patient → patients list.
export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    if (getActiveUserId()) {
      router.replace('/dashboard')
    } else {
      router.replace('/patients')
    }
  }, [router])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <span className="font-serif text-[24px] text-ink-2">Kindr.</span>
    </div>
  )
}
