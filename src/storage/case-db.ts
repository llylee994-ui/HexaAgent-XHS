import type { DivinationCase } from '../domain/types'
import { toStorageError } from './errors'
import { migrateCase } from './migrations'

const DB_NAME = 'wenyao'
const DB_VERSION = 1
const CASE_STORE = 'cases'

export type CaseEntry =
  | { mode: 'writable'; value: DivinationCase }
  | { mode: 'readonly'; raw: unknown; reason: string }

export interface CaseRepository {
  /** 全部可写卦例，按更新时间倒序 */
  list(): Promise<DivinationCase[]>
  /** 全部记录，含迁移失败只读记录（浏览原始摘要用） */
  listEntries(): Promise<CaseEntry[]>
  get(id: string): Promise<DivinationCase | null>
  /** 新增或整体更新；空间不足时抛出 StorageFullError 且不删除旧记录 */
  put(value: DivinationCase): Promise<void>
  delete(id: string): Promise<void>
  /** 按问题、标题、卦名、标签模糊搜索（不区分大小写） */
  search(query: string): Promise<DivinationCase[]>
  /** 修改已完成卦象：复制为新版本草稿，原记录不变 */
  duplicate(id: string): Promise<DivinationCase>
}

function openDatabase(indexedDB: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(CASE_STORE)) {
        db.createObjectStore(CASE_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'))
  })
}

async function withStore<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(CASE_STORE, mode)
    const request = action(transaction.objectStore(CASE_STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 操作失败'))
  })
}

function hexagramNames(value: DivinationCase): string[] {
  const names: string[] = []
  if (value.chart) {
    names.push(value.chart.original.name)
    if (value.chart.changed) {
      names.push(value.chart.changed.name)
    }
  }
  return names
}

function matchesQuery(value: DivinationCase, query: string): boolean {
  const haystack = [
    value.question,
    value.title,
    ...value.tags,
    ...hexagramNames(value),
  ]
    .join('\n')
    .toLowerCase()
  return haystack.includes(query)
}

function entryUpdatedAt(entry: CaseEntry): string {
  return entry.mode === 'writable' ? entry.value.updatedAt : ''
}

function sortByUpdatedAtDesc<T>(values: readonly T[]): T[] {
  return [...values].sort((a, b) => {
    const keyA = entryUpdatedAt(a as unknown as CaseEntry)
    const keyB = entryUpdatedAt(b as unknown as CaseEntry)
    return keyA < keyB ? 1 : keyA > keyB ? -1 : 0
  })
}

export function createCaseRepository(indexedDB: IDBFactory = globalThis.indexedDB): CaseRepository {
  if (!indexedDB) {
    throw new Error('IndexedDB 不可用')
  }

  async function loadEntries(): Promise<CaseEntry[]> {
    const db = await openDatabase(indexedDB)
    try {
      const records = await withStore(db, 'readonly', (store) => store.getAll())
      const entries = records.map<CaseEntry>((record) => {
        const migrated = migrateCase(record)
        return migrated.mode === 'writable'
          ? { mode: 'writable', value: migrated.value }
          : { mode: 'readonly', raw: record, reason: migrated.reason }
      })
      return sortByUpdatedAtDesc(entries)
    } finally {
      db.close()
    }
  }

  return {
    async list() {
      const entries = await loadEntries()
      return entries
        .filter((entry): entry is Extract<CaseEntry, { mode: 'writable' }> => entry.mode === 'writable')
        .map((entry) => entry.value)
    },

    async listEntries() {
      return loadEntries()
    },

    async get(id) {
      const db = await openDatabase(indexedDB)
      try {
        const record = await withStore(db, 'readonly', (store) => store.get(id))
        if (!record) {
          return null
        }
        const migrated = migrateCase(record)
        return migrated.mode === 'writable' ? migrated.value : null
      } finally {
        db.close()
      }
    },

    async put(value) {
      const db = await openDatabase(indexedDB)
      try {
        await withStore(db, 'readwrite', (store) => store.put(value as unknown as Record<string, unknown>))
      } catch (error) {
        // 不删除任何已有记录，交给调用方展示清理入口
        throw toStorageError(error)
      } finally {
        db.close()
      }
    },

    async delete(id) {
      const db = await openDatabase(indexedDB)
      try {
        await withStore(db, 'readwrite', (store) => store.delete(id))
      } finally {
        db.close()
      }
    },

    async search(query) {
      const normalized = query.trim().toLowerCase()
      if (!normalized) {
        return []
      }
      const all = await loadEntries()
      return all
        .filter((entry): entry is Extract<CaseEntry, { mode: 'writable' }> => entry.mode === 'writable')
        .map((entry) => entry.value)
        .filter((value) => matchesQuery(value, normalized))
    },

    async duplicate(id) {
      const source = await this.get(id)
      if (!source) {
        throw new Error('卦例不存在，无法复制')
      }
      const now = new Date().toISOString()
      const copy: DivinationCase = {
        ...structuredClone(source),
        id: crypto.randomUUID(),
        parentCaseId: source.id,
        status: 'draft',
        title: source.title ? `${source.title}（副本）` : '',
        createdAt: now,
        updatedAt: now,
      }
      await this.put(copy)
      return copy
    },
  }
}

