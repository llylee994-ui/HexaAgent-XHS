import type { DivinationCase } from '../domain/types'
import { StorageFullError, toStorageError } from './errors'
import { migrateCase } from './migrations'

const DRAFT_KEY = 'wenyao:active-draft'

function storage(): Storage {
  const s = globalThis.localStorage
  if (!s) {
    throw new Error('localStorage 不可用')
  }
  return s
}

/**
 * 未完成草稿持久化。同一时间只保留一个活动草稿：
 * 保存即整体替换，加载时经过迁移与结构校验，损坏数据直接清理。
 */
export const draftStore = {
  load(): DivinationCase | null {
    let raw: string | null
    try {
      raw = storage().getItem(DRAFT_KEY)
    } catch {
      return null
    }
    if (!raw) {
      return null
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      this.clear()
      return null
    }

    const migrated = migrateCase(parsed)
    if (migrated.mode !== 'writable') {
      this.clear()
      return null
    }
    return migrated.value
  },

  save(value: DivinationCase): void {
    try {
      storage().setItem(DRAFT_KEY, JSON.stringify(value))
    } catch (error) {
      throw toStorageError(error)
    }
  },

  clear(): void {
    try {
      storage().removeItem(DRAFT_KEY)
    } catch {
      // 清理失败不阻断主流程
    }
  },
}

export type DraftStore = typeof draftStore
export { StorageFullError }
