import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDraft } from '../../src/domain/factories'
import { draftStore } from '../../src/storage/draft-store'
import { StorageFullError } from '../../src/storage/errors'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
}

function memoryStorageWithFullQuota() {
  const map = new Map<string, string>()
  const quotaError = Object.assign(new Error('quota exceeded'), { name: 'QuotaExceededError' })
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: () => {
      throw quotaError
    },
    removeItem: (key: string) => void map.delete(key),
  }
}

function buildDraft(rawValues: number[] = []) {
  const draft = createDraft({
    question: '工作调动能否顺利',
    category: 'career',
    castAt: new Date(2026, 7, 28, 12, 0).toISOString(),
    method: 'simulated-coins',
  })
  return { ...draft, rawValues: rawValues as never }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('draftStore', () => {
  it('保存后可以恢复相同草稿', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    const draft = buildDraft()
    draftStore.save(draft)
    expect(draftStore.load()).toEqual(draft)
  })

  it('损坏的 JSON 会被清理并返回 null', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    localStorage.setItem('wenyao:active-draft', '{not-json')
    expect(draftStore.load()).toBeNull()
    expect(localStorage.getItem('wenyao:active-draft')).toBeNull()
  })

  it('结构不合法的草稿同样清理并返回 null', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    localStorage.setItem('wenyao:active-draft', JSON.stringify({ question: 123 }))
    expect(draftStore.load()).toBeNull()
    expect(localStorage.getItem('wenyao:active-draft')).toBeNull()
  })

  it('同一时间只保留一个活动草稿', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    const first = buildDraft()
    const second = buildDraft()
    draftStore.save(first)
    draftStore.save(second)
    expect(draftStore.load()).toEqual(second)
  })

  it('六爻未完成的草稿可以保存和恢复', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    const partial = buildDraft([7, 8, 9])
    draftStore.save(partial)
    expect(draftStore.load()?.rawValues).toEqual([7, 8, 9])
  })

  it('存储空间不足时抛出 StorageFullError 且不丢已有草稿', () => {
    vi.stubGlobal('localStorage', memoryStorageWithFullQuota())
    expect(() => draftStore.save(buildDraft())).toThrow(StorageFullError)
  })
})
