import type { AppData } from './types'

// ── Shape stored per user in the index list ───────────────────────────────────

export interface UserRecord {
  id:           string
  name:         string
  dateCreated:  string  // ISO date
  lastUpdated:  string  // ISO date
  overallScore: number  // cached from currentScores.overall (0 if unassessed)
  hasQuestionnaire: boolean
  hasLabResults:    boolean
}

// ── localStorage key schema ───────────────────────────────────────────────────

const USERS_KEY   = 'kindr_users'
const DATA_PREFIX = 'kindr_data_'
const ACTIVE_KEY  = 'kindr_active_user'

function ok(): boolean {
  return typeof window !== 'undefined'
}

// ── User index ────────────────────────────────────────────────────────────────

export function listUsers(): UserRecord[] {
  if (!ok()) return []
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]') as UserRecord[]
  } catch { return [] }
}

function _saveIndex(users: UserRecord[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function getUserRecord(id: string): UserRecord | undefined {
  return listUsers().find(u => u.id === id)
}

// ── Per-user data ─────────────────────────────────────────────────────────────

export function loadUserData(id: string): AppData | null {
  if (!ok()) return null
  try {
    const raw = localStorage.getItem(DATA_PREFIX + id)
    return raw ? (JSON.parse(raw) as AppData) : null
  } catch { return null }
}

export function persistUserData(id: string, data: AppData): void {
  if (!ok()) return
  localStorage.setItem(DATA_PREFIX + id, JSON.stringify(data))

  // Keep the index entry in sync
  const users = listUsers()
  const idx   = users.findIndex(u => u.id === id)
  if (idx >= 0) {
    const h = data.questionnaire.history
    const hasQ = !!(h.sex || h.heightCm || h.weightKg)
    const hasL = Object.values(data.bloodPanel).some(g =>
      Object.values(g).some(r => r.value !== ''),
    )
    users[idx] = {
      ...users[idx],
      lastUpdated:      new Date().toISOString().split('T')[0],
      overallScore:     Math.round(data.currentScores.overall ?? 0),
      hasQuestionnaire: hasQ,
      hasLabResults:    hasL,
    }
    _saveIndex(users)
  }
}

// ── Active-user pointer ───────────────────────────────────────────────────────

export function getActiveUserId(): string | null {
  if (!ok()) return null
  return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveUserId(id: string | null): void {
  if (!ok()) return
  if (id === null) localStorage.removeItem(ACTIVE_KEY)
  else localStorage.setItem(ACTIVE_KEY, id)
}

// ── Create / delete ───────────────────────────────────────────────────────────

export function createStoredUser(name: string, initialData: AppData): UserRecord {
  const id  = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString().split('T')[0]
  const record: UserRecord = {
    id,
    name,
    dateCreated:      now,
    lastUpdated:      now,
    overallScore:     0,
    hasQuestionnaire: false,
    hasLabResults:    false,
  }
  const users = listUsers()
  users.push(record)
  _saveIndex(users)
  persistUserData(id, { ...initialData, user: { ...initialData.user, name } })
  return record
}

export function deleteStoredUser(id: string): void {
  if (!ok()) return
  const users = listUsers().filter(u => u.id !== id)
  _saveIndex(users)
  localStorage.removeItem(DATA_PREFIX + id)
  if (getActiveUserId() === id) setActiveUserId(null)
}
