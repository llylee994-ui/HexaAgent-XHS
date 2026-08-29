import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createDraft } from '../../src/domain/factories'
import type { AiAnswer, DivinationCase, PromptSnapshot } from '../../src/domain/types'
import { buildChart } from '../../src/engines/najia/chart'
import { createCaseRepository } from '../../src/storage/case-db'

const CAST_AT_DATE = new Date(2026, 7, 28, 12, 0)

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
