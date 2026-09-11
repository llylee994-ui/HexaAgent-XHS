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

  it('v1 记录迁移到 v2：补默认排盘时区并标记 assumed', () => {
    const { timeZone: _dropped, ...withoutZone } = validCaseRecord()
    void _dropped
    const result = migrateCase({ ...withoutZone, schemaVersion: 1 })
    expect(result.mode).toBe('writable')
    if (result.mode === 'writable') {
      expect(result.value.schemaVersion).toBe(2)
      expect(result.value.timeZone).toEqual({
        id: 'Asia/Shanghai',
        label: '北京时间',
        offsetMinutes: 480,
        assumed: true,
      })
    }
  })

  it('v1 记录的排盘快照在迁移后逐字段不变（不重算旧卦例）', () => {
    const chart = {
      original: { name: '天风姤' },
      sizhu: { year: '丙午', month: '丙申', day: '甲戌', hour: '庚午' },
      xunKong: ['申', '酉'],
    }
    const { timeZone: _dropped, ...withoutZone } = validCaseRecord()
    void _dropped
    const result = migrateCase({
      ...withoutZone,
      schemaVersion: 1,
      status: 'cast',
      rawValues: [6, 7, 7, 7, 7, 7],
      chart,
    })
    expect(result.mode).toBe('writable')
    if (result.mode === 'writable') {
      expect(result.value.chart).toEqual(chart)
      expect(result.value.castAt).toBe('2026-08-28T04:00:00.000Z')
    }
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
