'use client'

import {
  createContext, useContext, useState, useEffect, useCallback,
  type ReactNode,
} from 'react'
import {
  listUsers, getActiveUserId, setActiveUserId,
  createStoredUser, deleteStoredUser, persistUserData, loadUserData,
  type UserRecord,
} from './storage'
import type { AppData } from './types'

// ── Context shape ─────────────────────────────────────────────────────────────

interface UserContextValue {
  /** All registered patients. */
  users: UserRecord[]
  /** ID of the patient whose data is currently loaded (null = no active patient). */
  activeUserId: string | null

  /** Create a new patient with a blank data record. Returns the new user ID. */
  createUser: (name: string, initialData: AppData) => string
  /**
   * Switch to a different patient.
   * Persists current data to localStorage then does a full page reload so the
   * module-level derived computations (findings, report, plan) re-initialise
   * with the new patient's data.
   */
  switchUser: (id: string) => void
  /** Delete a patient record (and remove them from the index). */
  deleteUser: (id: string) => void
  /**
   * Flush the current in-memory mockData to localStorage for the active user.
   * Call this after any mutation (saveQuestionnaire, saveBloodPanel, etc.).
   */
  persistActive: (data: AppData) => void
  /** Refresh the user list from localStorage (after external writes). */
  refreshUsers: () => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [users,        setUsers]        = useState<UserRecord[]>([])
  const [activeUserId, setActiveUserIdState] = useState<string | null>(null)

  useEffect(() => {
    setUsers(listUsers())
    setActiveUserIdState(getActiveUserId())
  }, [])

  const refreshUsers = useCallback(() => setUsers(listUsers()), [])

  const createUser = useCallback((name: string, initialData: AppData): string => {
    const record = createStoredUser(name, initialData)
    setUsers(prev => [...prev, record])
    return record.id
  }, [])

  const switchUser = useCallback((id: string) => {
    setActiveUserId(id)
    // Hard reload — forces the module to re-initialise from the new user's localStorage data.
    window.location.href = '/dashboard'
  }, [])

  const deleteUser = useCallback((id: string) => {
    deleteStoredUser(id)
    setUsers(prev => prev.filter(u => u.id !== id))
    if (activeUserId === id) {
      setActiveUserId(null)
      setActiveUserIdState(null)
    }
  }, [activeUserId])

  const persistActive = useCallback((data: AppData) => {
    const id = getActiveUserId()
    if (id) persistUserData(id, data)
  }, [])

  return (
    <UserContext.Provider
      value={{ users, activeUserId, createUser, switchUser, deleteUser, persistActive, refreshUsers }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUserContext(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUserContext must be used inside <UserProvider>')
  return ctx
}

// ── Convenience: load a specific patient's data directly ──────────────────────

export { loadUserData }
