import { describe, expect, it } from 'vitest'
import { createDraft } from '../../src/domain/factories'
import { migrateCase } from '../../src/storage/migrations'
import { toStorageError } from '../../src/storage/errors'

function validCaseRecord() {
  const draft = createDraft({
    question: '项目能否按期交付',
    category: 'career',
    castAt: '2026-08-28T04:00:00.000Z',
    method: 'manual',
  })
  return { ...draft, rawValues: [7, 7, 7, 7, 7, 7] }
}

describe('migrateCase', () => {
  it('当前版本的合法卦例直读为 writable', () => {
    const result = migrateCase(validCaseRecord())
    expect(result.mode).toBe('writable')
    if (result.mode === 'writable') {
      expect(result.value.question).toBe('项目能否按期交付')
    }
  })

  it('当前版本但结构不合法 → 只读', () => {
    const result = migrateCase({ ...validCaseRecord(), question: 123 })
    expect(result.mode).toBe('readonly')
  })

  it('来自更新版本的数据 → 只读保留原始数据', () => {
    const result = migrateCase({ ...validCaseRecord(), schemaVersion: 999 })
    expect(result.mode).toBe('readonly')
    if (result.mode === 'readonly') {
      expect(result.reason).toContain('更新版本')
      expect(result.raw).toMatchObject({ schemaVersion: 999 })
    }
  })

  it('缺少迁移路径的旧版本 → 只读', () => {
    const result = migrateCase({ ...validCaseRecord(), schemaVersion: 0 })
    expect(result.mode).toBe('readonly')
    if (result.mode === 'readonly') {
      expect(result.reason).toContain('迁移')
    }
  })

  it('迁移过程抛出异常 → 只读保留原始数据', () => {
    const poisoned = Object.defineProperties({}, {
      schemaVersion: {
        get() {
          throw new Error('boom')
        },
        enumerable: true,
      },
    })
    const result = migrateCase(poisoned)
    expect(result.mode).toBe('readonly')
  })

  it('非对象数据 → 只读', () => {
    expect(migrateCase(null).mode).toBe('readonly')
    expect(migrateCase('junk').mode).toBe('readonly')
  })
})

describe('toStorageError', () => {
  it('QuotaExceededError 转换为 StorageFullError', () => {
    const quota = Object.assign(new Error('quota'), { name: 'QuotaExceededError' })
    expect(toStorageError(quota)).toBeInstanceOf(Error)
    expect((toStorageError(quota) as Error).name).toBe('StorageFullError')
  })

  it('其他错误原样返回', () => {
    const plain = new Error('boom')
    expect(toStorageError(plain)).toBe(plain)
  })
})
