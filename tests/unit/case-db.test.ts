import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createDraft } from '../../src/domain/factories'
import type { AiAnswer, DivinationCase, PromptSnapshot } from '../../src/domain/types'
import { buildChart, isSizhuOverridden } from '../../src/engines/najia/chart'
import { createCaseRepository } from '../../src/storage/case-db'
import { beijing } from '../fixtures/beijing-time'

const CAST_AT_DATE = beijing('2026-08-28 12:00')

function buildSavedCase(overrides: Partial<DivinationCase> = {}): DivinationCase {
  const draft = createDraft({
    question: '换工作能否顺利',
    category: 'career',
    castAt: CAST_AT_DATE.toISOString(),
    method: 'simulated-coins',
  })
  return {
    ...draft,
    status: 'cast',
    rawValues: [6, 7, 7, 7, 7, 7],
    chart: buildChart([6, 7, 7, 7, 7, 7], CAST_AT_DATE),
    title: '换工作',
    ...overrides,
  }
}

function repo() {
  return createCaseRepository(new IDBFactory())
}

/** 直接往库里写原始记录，模拟旧版本（0.1.0）留在 IndexedDB 里的数据 */
function seedRawRecord(factory: IDBFactory, record: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.open('wenyao', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('cases')) {
        db.createObjectStore('cases', { keyPath: 'id' })
      }
    }
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('cases', 'readwrite')
      transaction.objectStore('cases').put(record)
      transaction.oncomplete = () => {
        db.close()
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)
    }
    request.onerror = () => reject(request.error)
  })
}

function readRawRecord(factory: IDBFactory, id: string): Promise<Record<string, unknown> | undefined> {
  return new Promise((resolve, reject) => {
    const request = factory.open('wenyao', 1)
    request.onsuccess = () => {
      const db = request.result
      const store = db.transaction('cases', 'readonly').objectStore('cases')
      const get = store.get(id)
      get.onsuccess = () => {
        db.close()
        resolve(get.result as Record<string, unknown> | undefined)
      }
      get.onerror = () => reject(get.error)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * 一条 0.1.0 形态的记录：schemaVersion 1、engineVersion 0.1.0、没有 timeZone，
 * 且四柱快照用的是当时的固定日期表（2026 白露被算在 9/8，所以 9/7 23:00 的月柱是丙申）。
 */
function legacyV1Record(): Record<string, unknown> {
  const value = buildSavedCase({
    castAt: beijing('2026-09-07 23:00').toISOString(),
    title: '旧版卦例',
  })
  const { timeZone: _timeZone, ...withoutTimeZone } = value
  void _timeZone
  return {
    ...withoutTimeZone,
    schemaVersion: 1,
    engineVersion: '0.1.0',
    chart: { ...value.chart!, sizhu: { ...value.chart!.sizhu, month: '丙申' } },
  }
}

describe('caseRepository 增删改查', () => {
  it('put 后 get 返回相同卦例，get 不存在返回 null', async () => {
    const repository = repo()
    const value = buildSavedCase()
    await repository.put(value)
    expect(await repository.get(value.id)).toEqual(value)
    expect(await repository.get('missing')).toBeNull()
  })

  it('list 按更新时间倒序', async () => {
    const repository = repo()
    const older = buildSavedCase({ updatedAt: '2026-08-01T00:00:00.000Z' })
    const newer = buildSavedCase({ updatedAt: '2026-08-20T00:00:00.000Z' })
    await repository.put(older)
    await repository.put(newer)
    const listed = await repository.list()
    expect(listed.map((value) => value.updatedAt)).toEqual([
      '2026-08-20T00:00:00.000Z',
      '2026-08-01T00:00:00.000Z',
    ])
  })

  it('delete 后不再可读', async () => {
    const repository = repo()
    const value = buildSavedCase()
    await repository.put(value)
    await repository.delete(value.id)
    expect(await repository.get(value.id)).toBeNull()
  })
})

describe('caseRepository 搜索', () => {
  it('可按问题、标题、卦名、标签搜索', async () => {
    const repository = repo()
    await repository.put(buildSavedCase({ id: 'a', title: '换工作', question: '跳槽去新公司顺不顺利' }))
    await repository.put(buildSavedCase({
      id: 'b',
      title: '考试',
      question: '考试发挥如何',
      tags: ['学业'],
      chart: buildChart([7, 7, 7, 7, 7, 7], CAST_AT_DATE),
    }))

    expect((await repository.search('跳槽')).map((v) => v.id)).toEqual(['a'])
    expect((await repository.search('换工')).map((v) => v.id)).toEqual(['a'])
    // 卦名搜索同时命中本卦与变卦：a 的变卦为乾为天，b 的本卦为乾为天
    expect(new Set((await repository.search('乾为天')).map((v) => v.id))).toEqual(new Set(['a', 'b']))
    expect((await repository.search('学业')).map((v) => v.id)).toEqual(['b'])
    expect(await repository.search('不存在的关键词')).toEqual([])
  })

  it('搜索不区分大小写与首尾空格', async () => {
    const repository = repo()
    await repository.put(buildSavedCase({ id: 'a', title: 'Job A' }))
    expect((await repository.search('  job a  ')).map((v) => v.id)).toEqual(['a'])
  })
})

describe('caseRepository 多个 AI 回答与版本复制', () => {
  it('保存多个回答互不覆盖', async () => {
    const repository = repo()
    const prompt: PromptSnapshot = {
      id: 'prompt-1',
      variant: 'concise',
      version: '1.0.0',
      content: '提示词内容',
      createdAt: '2026-08-28T12:00:00.000Z',
    }
    const first: AiAnswer = {
      id: 'answer-1',
      source: 'DeepSeek',
      promptId: 'prompt-1',
      content: '第一个回答',
      createdAt: '2026-08-28T13:00:00.000Z',
    }
    const second: AiAnswer = {
      id: 'answer-2',
      source: 'ChatGPT',
      promptId: 'prompt-1',
      content: '第二个回答',
      createdAt: '2026-08-28T14:00:00.000Z',
    }
    const value = buildSavedCase({ status: 'answered', prompts: [prompt], answers: [first] })
    await repository.put(value)

    const updated = { ...value, answers: [first, second], updatedAt: '2026-08-29T00:00:00.000Z' }
    await repository.put(updated)
    const stored = await repository.get(value.id)
    expect(stored?.answers).toHaveLength(2)
  })

  it('duplicate 复制为新版本：新 ID、关联原卦例、状态回到草稿', async () => {
    const repository = repo()
    const value = buildSavedCase({ title: '换工作' })
    await repository.put(value)

    const copy = await repository.duplicate(value.id)
    expect(copy.id).not.toBe(value.id)
    expect(copy.parentCaseId).toBe(value.id)
    expect(copy.status).toBe('draft')
    expect(copy.title).toBe('换工作（副本）')
    expect(copy.rawValues).toEqual(value.rawValues)
    expect(copy.chart).toEqual(value.chart)

    // 原记录不受影响，副本已入库
    expect(await repository.get(value.id)).toEqual(value)
    expect((await repository.list()).map((v) => v.id)).toContain(copy.id)
  })
})

/**
 * 升级兼容：用户升级到 0.2.0 后，库里已有的 0.1.0 记录必须照常读得出来。
 * 这正是"覆盖更新后本地数据看起来丢了"的真实成因，因此按下述行为固化。
 */
describe('旧版本（0.1.0）记录升级后的读取', () => {
  it('v1 记录迁移后可读可写：补时区、快照不被改写', async () => {
    const factory = new IDBFactory()
    const legacy = legacyV1Record()
    await seedRawRecord(factory, legacy)
    const repository = createCaseRepository(factory)

    const entries = await repository.listEntries()
    expect(entries).toHaveLength(1)
    const entry = entries[0]
    expect(entry.mode).toBe('writable')
    if (entry.mode !== 'writable') return

    // 迁移只补元数据
    expect(entry.value.schemaVersion).toBe(2)
    expect(entry.value.timeZone).toEqual({
      id: 'Asia/Shanghai',
      label: '北京时间',
      offsetMinutes: 480,
      assumed: true,
    })
    // 内容与旧排盘快照原样保留
    expect(entry.value.title).toBe('旧版卦例')
    expect(entry.value.question).toBe('换工作能否顺利')
    expect(entry.value.chart).toEqual(legacy.chart)
    expect(entry.value.chart?.sizhu.month).toBe('丙申')
    // 旧快照确实与新版重算不同（白露 22:41 之后应属丁酉月），但升级不重算历史卦例
    const recomputed = buildChart(entry.value.rawValues, entry.value.castAt)
    expect(recomputed.sizhu.month).toBe('丁酉')

    // 旧记录仍可继续使用：改标题后写回，快照依旧不变
    await repository.put({ ...entry.value, title: '改过标题的旧卦例' })
    const updated = await repository.get(legacy.id as string)
    expect(updated?.title).toBe('改过标题的旧卦例')
    expect(updated?.chart).toEqual(legacy.chart)
  })

  it('get 读旧记录同样返回迁移结果', async () => {
    const factory = new IDBFactory()
    const legacy = legacyV1Record()
    await seedRawRecord(factory, legacy)
    const repository = createCaseRepository(factory)

    const fetched = await repository.get(legacy.id as string)
    expect(fetched?.schemaVersion).toBe(2)
    expect(fetched?.timeZone?.assumed).toBe(true)
    // 迁移件不冒充"人工校正"
    expect(isSizhuOverridden(fetched!.castAt, fetched!.chart, fetched!.timeZone)).toBe(false)
  })

  it('迁移校验失败的旧记录以只读保留，原始数据不从库里删除', async () => {
    const factory = new IDBFactory()
    await seedRawRecord(factory, { id: 'broken-legacy', schemaVersion: 1, question: 123 })
    const repository = createCaseRepository(factory)

    const entries = await repository.listEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].mode).toBe('readonly')
    // 列表里不出现可写条目，但原始记录仍在
    expect(await repository.list()).toEqual([])
    expect(await readRawRecord(factory, 'broken-legacy')).toMatchObject({ question: 123 })
  })
})
