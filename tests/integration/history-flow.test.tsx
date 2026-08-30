import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CaseStatus, DivinationCase, PromptSnapshot } from '../../src/domain/types'
import { createDraft } from '../../src/domain/factories'
import { buildChart } from '../../src/engines/najia/chart'
import App from '../../src/app/App'
import { HistoryPage } from '../../src/features/history/HistoryPage'
import { createCaseRepository, type CaseRepository } from '../../src/storage/case-db'
import { StorageFullError } from '../../src/storage/errors'

const CAST_AT = new Date(2026, 7, 28, 12, 0)
const repository = createCaseRepository()

async function seedCase(
  title: string,
  status: CaseStatus,
  updatedAt: string,
  overrides: Partial<DivinationCase> = {},
): Promise<DivinationCase> {
  const draft = createDraft({
    question: `${title}的问题`,
    category: 'career',
    castAt: CAST_AT.toISOString(),
    method: 'simulated-coins',
  })
  const prompt: PromptSnapshot = {
    id: `prompt-${title}`,
    variant: 'concise',
    version: '1.0.0',
    content: '提示词',
    createdAt: updatedAt,
  }
  const value: DivinationCase = {
    ...draft,
    status,
    rawValues: [6, 7, 7, 7, 7, 7],
    chart: buildChart([6, 7, 7, 7, 7, 7], CAST_AT),
    observations: [],
    title,
    updatedAt,
    prompts: status === 'cast' ? [] : [prompt],
    answers:
      status === 'answered' || status === 'verified'
        ? [{ id: `answer-${title}`, source: 'DeepSeek', promptId: prompt.id, content: '解读', createdAt: updatedAt }]
        : [],
    verification: status === 'verified' ? '已验证' : '',
    ...overrides,
  }
  await repository.put(value)
  return value
}

async function seedFourCases() {
  await seedCase('标题A', 'cast', '2026-08-01T00:00:00.000Z')
  await seedCase('标题B', 'prompted', '2026-08-02T00:00:00.000Z', { tags: ['面试'] })
  await seedCase('标题C', 'answered', '2026-08-03T00:00:00.000Z')
  return seedCase('标题D', 'verified', '2026-08-04T00:00:00.000Z')
}

async function openHistory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: '卦例记录' }))
  await screen.findByText('卦例记录')
}

beforeEach(async () => {
  for (const value of await repository.list()) {
    await repository.delete(value.id)
  }
})

describe('历史页时间线', () => {
  it('按更新时间倒序展示并映射状态标签', async () => {
    const user = userEvent.setup()
    await seedFourCases()
    render(<App />)
    await openHistory(user)

    expect(await screen.findByText('标题D')).toBeTruthy()
    const titles = screen.getAllByText(/^标题[A-D]$/).map((el) => el.textContent)
    expect(titles).toEqual(['标题D', '标题C', '标题B', '标题A'])

    expect(screen.getByText('仅排盘')).toBeTruthy()
    expect(screen.getByText('已生成提示词')).toBeTruthy()
    expect(screen.getByText('已保存 AI 回答')).toBeTruthy()
    expect(screen.getByText('已补充后续验证')).toBeTruthy()
  })

  it('可按标签搜索卦例', async () => {
    const user = userEvent.setup()
    await seedFourCases()
    render(<App />)
    await openHistory(user)
    await screen.findByText('标题D')

    fireEvent.change(screen.getByLabelText('搜索卦例'), { target: { value: '面试' } })
    await user.click(screen.getByRole('button', { name: '搜索' }))
    await waitFor(
      () => {
        expect(screen.queryByText('标题A')).toBeNull()
        expect(screen.getByText('标题B')).toBeTruthy()
      },
      { timeout: 5000 },
    )

    await user.click(screen.getByRole('button', { name: '清除' }))
    expect(await screen.findByText('标题A')).toBeTruthy()
  })

  it('删除需要确认', async () => {
    const user = userEvent.setup()
    await seedFourCases()
    render(<App />)
    await openHistory(user)
    await screen.findByText('标题D')

    await user.click(screen.getAllByRole('button', { name: '删除' })[0])
    expect(screen.getByRole('dialog')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    await waitFor(() => expect(screen.queryByText('标题D')).toBeNull())
    expect(screen.getByText('标题C')).toBeTruthy()
  })

  it('修改完成卦象复制为新版本，不覆盖原记录', async () => {
    const user = userEvent.setup()
    const original = await seedFourCases()
    render(<App />)
    await openHistory(user)
    await screen.findByText('标题D')

    const cards = screen.getAllByRole('button', { name: '修改为副本' })
    await user.click(cards[0])

    // 进入副本的结果页
    const titleInput = (await screen.findByLabelText('卦例标题')) as HTMLInputElement
    expect(titleInput.value).toBe('标题D（副本）')

    // 原记录不变
    const stored = await repository.get(original.id)
    expect(stored?.title).toBe('标题D')
    expect((await repository.list()).length).toBe(5)
  })
})

describe('首页最近卦例', () => {
  it('首页只显示最近三条', async () => {
    await seedFourCases()
    render(<App />)

    expect(await screen.findByText('标题D')).toBeTruthy()
    expect(screen.getByText('标题C')).toBeTruthy()
    expect(screen.getByText('标题B')).toBeTruthy()
    expect(screen.queryByText('标题A')).toBeNull()
  })
})

describe('只读降级与存储满', () => {
  it('迁移失败的记录以只读形式展示原始摘要，不提供编辑入口', async () => {
    const fakeRepo = {
      list: async () => [],
      get: async () => null,
      put: async () => {},
      delete: async () => {},
      search: async () => [],
      duplicate: async () => {
        throw new Error('不可编辑')
      },
      listEntries: async () => [
        {
          mode: 'readonly' as const,
          raw: { question: '旧版本卦例', schemaVersion: 999 },
          reason: '数据来自更新版本的小工具',
        },
      ],
    } as unknown as CaseRepository

    render(<HistoryPage repository={fakeRepo} onView={() => {}} onBack={() => {}} />)
    expect((await screen.findAllByText(/只读/)).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('button', { name: '修改为副本' })).toBeNull()
    expect(screen.queryByRole('button', { name: '删除' })).toBeNull()
  })

  it('存储空间不足时展示清理提示，且不静默丢失数据', async () => {
    const writable = await seedCase('容量案例', 'cast', '2026-08-05T00:00:00.000Z')
    const fakeRepo: CaseRepository = {
      list: async () => [writable],
      get: async () => writable,
      put: async () => {
        throw new StorageFullError()
      },
      delete: async () => {},
      search: async () => [writable],
      duplicate: async () => {
        throw new StorageFullError()
      },
      listEntries: async () => [{ mode: 'writable', value: writable }],
    }

    const user = userEvent.setup()
    render(<HistoryPage repository={fakeRepo} onView={() => {}} onBack={() => {}} />)
    await screen.findByText('容量案例')

    await user.click(screen.getByRole('button', { name: '修改为副本' }))
    expect(await screen.findByText(/存储空间不足/)).toBeTruthy()
  })
})
