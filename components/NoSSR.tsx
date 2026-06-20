'use client'

import { type ReactNode, useEffect, useState } from 'react'

/**
 * Prevents children from being server-rendered.
 * Used in the shell layout so that pages reading from the localStorage-backed
 * mockData singleton don't cause React hydration mismatches (server always
 * initialises mockData with the Alex demo because window is undefined during
 * SSR, while the client loads the active patient's data from localStorage).
 */
export function NoSSR({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? <>{children}</> : null
}
