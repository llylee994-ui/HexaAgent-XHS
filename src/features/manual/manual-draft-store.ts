import type { LinePosition, RawYaoValue } from '../../domain/types'
import type { ManualEditorState } from './model'
import { searchHexagrams } from './catalog'
import { toStorageError } from '../../storage/errors'

export interface ManualDraftSnapshot extends ManualEditorState {
  version: 1
  caseId: string
  openFushen: readonly LinePosition[]
  updatedAt: string
}

export interface ManualDraftStore {
  load(): ManualDraftSnapshot | null
  save(snapshot: ManualDraftSnapshot): void
  clear(): void
}

export const MANUAL_DRAFT_KEY = 'wenyao:manual-editor-draft:v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isRawValue(value: unknown): value is RawYaoValue {
  return value === 6 || value === 7 || value === 8 || value === 9
}

function isLinePosition(value: unknown): value is LinePosition {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value))
}

function isValidSnapshot(value: unknown): value is ManualDraftSnapshot {
  if (!isRecord(value) || value.version !== 1) return false
  if (typeof value.caseId !== 'string' || typeof value.question !== 'string') return false
  if (typeof value.note !== 'string' || typeof value.selectedHexagramName !== 'string') return false
  if (!isIsoDate(value.castAt) || !isIsoDate(value.updatedAt)) return false
  if (!Array.isArray(value.rawValues) || value.rawValues.length !== 6 || !value.rawValues.every(isRawValue)) return false
  if (!Array.isArray(value.openFushen) || !value.openFushen.every(isLinePosition)) return false
  if (new Set(value.openFushen).size !== value.openFushen.length) return false
  if (value.selectedHexagramName && !searchHexagrams(value.selectedHexagramName).some((item) => item.name === value.selectedHexagramName)) return false
  if (!isRecord(value.overrides)) return false
  return true
}

function storage(): Storage | null {
  return globalThis.localStorage ?? null
}

export const manualDraftStore: ManualDraftStore = {
  load() {
    const current = storage()
    if (!current) return null
    const raw = current.getItem(MANUAL_DRAFT_KEY)
    if (!raw) return null
    try {
      const parsed: unknown = JSON.parse(raw)
      return isValidSnapshot(parsed) ? parsed : null
    } catch {
      return null
    }
  },

  save(snapshot) {
    const current = storage()
    if (!current) throw new Error('localStorage 不可用')
    try {
      current.setItem(MANUAL_DRAFT_KEY, JSON.stringify(snapshot))
    } catch (error) {
      throw toStorageError(error)
    }
  },

  clear() {
    try {
      storage()?.removeItem(MANUAL_DRAFT_KEY)
    } catch {
      // 清理失败不阻断主流程
    }
  },
}
