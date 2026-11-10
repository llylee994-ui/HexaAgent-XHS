import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CaseStatus, DivinationCase, PromptSnapshot } from '../../src/domain/types'
import { createDraft } from '../../src/domain/factories'
import { buildChart } from '../../src/engines/najia/chart'
import App from '../../src/app/App'
import { HistoryPage } from '../../src/features/history/HistoryPage'
import { HomePage } from '../../src/features/home/HomePage'
import { createCaseRepository, type CaseRepository } from '../../src/storage/case-db'
import { StorageFullError } from '../../src/storage/errors'
import { beijing } from '../fixtures/beijing-time'

const CAST_AT = beijing('2026-08-28 12:00')
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
  it('读取记录期间显示加载反馈，不提前展示空态', async () => {
    let resolveEntries!: (entries: Awaited<ReturnType<CaseRepository['listEntries']>>) => void
    const entriesPromise = new Promise<Awaited<ReturnType<CaseRepository['listEntries']>>>((resolve) => {
      resolveEntries = resolve
    })
    const fakeRepo = { listEntries: () => entriesPromise } as unknown as CaseRepository

    render(<HistoryPage repository={fakeRepo} onView={() => {}} onBack={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('正在加载卦例')
    expect(screen.queryByText('还没有卦例，先从一次摇卦开始。')).toBeNull()
    expect(screen.getByRole('button', { name: '搜索' })).toBeDisabled()

    resolveEntries([])
    expect(await screen.findByText('还没有卦例，先从一次摇卦开始。')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: '搜索' })).toBeEnabled()
  })

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
    expect(screen.getByRole('dialog').parentElement).toBe(document.body)
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

describe('批量删除', () => {
  it('管理模式下勾选多条后一次删除，未选中的记录保留', async () => {
    const user = userEvent.setup()
    await seedFourCases()
    render(<App />)
    await openHistory(user)
    await screen.findByText('标题D')

    await user.click(screen.getByRole('button', { name: '管理' }))
    expect(screen.getByRole('button', { name: '删除选中（0 条）' })).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: '选择「标题D」' }))
    await user.click(screen.getByRole('checkbox', { name: '选择「标题C」' }))
    expect(screen.getByText(/已选 2 条 \/ 可删 4 条/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '删除选中（2 条）' }))
    expect(screen.getByRole('dialog').parentElement).toBe(document.body)
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    await waitFor(() => expect(screen.queryByText('标题D')).toBeNull())
    expect(screen.queryByText('标题C')).toBeNull()
    expect(screen.getByText('标题B')).toBeTruthy()
    expect(screen.getByText('标题A')).toBeTruthy()
    expect((await repository.list()).map((value) => value.title)).toEqual(['标题B', '标题A'])
  })

  it('点卡片标题即可勾选，全选后删除整页并回到空态', async () => {
    const user = userEvent.setup()
    await seedFourCases()
    render(<App />)
    await openHistory(user)
    await screen.findByText('标题D')

    await user.click(screen.getByRole('button', { name: '管理' }))
    await user.click(screen.getByText('标题D'))
    expect(screen.getByText(/已选 1 条/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '全选' }))
    expect(screen.getByText(/已选 4 条 \/ 可删 4 条/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '取消全选' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '删除选中（4 条）' }))
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    expect(await screen.findByText('还没有卦例，先从一次摇卦开始。')).toBeTruthy()
    expect(await repository.list()).toEqual([])
  })

  it('搜索结果里全选只作用于命中的记录，删除后仍保持搜索结果', async () => {
    const user = userEvent.setup()
    await seedFourCases()
    render(<App />)
    await openHistory(user)
    await screen.findByText('标题D')

    fireEvent.change(screen.getByLabelText('搜索卦例'), { target: { value: '面试' } })
    await user.click(screen.getByRole('button', { name: '搜索' }))
    // 等搜索结果真正落地：加载期间整张列表都不渲染，只断言"某条标题消失"会在加载中途提前返回
    await waitFor(() =>
      expect(screen.getAllByText(/^标题[A-D]$/).map((element) => element.textContent)).toEqual(['标题B']),
    )

    await user.click(screen.getByRole('button', { name: '管理' }))
    await user.click(screen.getByRole('button', { name: '全选' }))
    expect(screen.getByText(/已选 1 条 \/ 可删 1 条/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '删除选中（1 条）' }))
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    // 列表维持搜索结果而不是跳回全量，计数与备份用的全量列表同步刷新
    expect(await screen.findByText('没有找到匹配的卦例。')).toBeTruthy()
    expect(screen.getByText('共 3 条记录')).toBeTruthy()
    expect(screen.getByLabelText('搜索卦例')).toHaveValue('面试')
    expect((await repository.list()).map((value) => value.title)).toEqual(['标题D', '标题C', '标题A'])

    await user.click(screen.getByRole('button', { name: '清除' }))
    expect(await screen.findByText('标题A')).toBeTruthy()
  })

  it('搜索状态下单条删除后列表同样保持搜索结果', async () => {
    const user = userEvent.setup()
    await seedFourCases()
    render(<App />)
    await openHistory(user)
    await screen.findByText('标题D')

    fireEvent.change(screen.getByLabelText('搜索卦例'), { target: { value: '面试' } })
    await user.click(screen.getByRole('button', { name: '搜索' }))
    await waitFor(() =>
      expect(screen.getAllByText(/^标题[A-D]$/).map((element) => element.textContent)).toEqual(['标题B']),
    )

    await user.click(screen.getByRole('button', { name: '删除', exact: true }))
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    expect(await screen.findByText('没有找到匹配的卦例。')).toBeTruthy()
    expect(screen.getByText('共 3 条记录')).toBeTruthy()
    expect((await repository.list()).map((value) => value.title)).toEqual(['标题D', '标题C', '标题A'])
  })

  it('退出管理模式后卡片恢复跳转，选择不保留', async () => {
    const user = userEvent.setup()
    await seedFourCases()
    render(<App />)
    await openHistory(user)
    await screen.findByText('标题D')

    await user.click(screen.getByRole('button', { name: '管理' }))
    await user.click(screen.getByRole('checkbox', { name: '选择「标题D」' }))
    await user.click(screen.getByRole('button', { name: '完成' }))

    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByRole('button', { name: '标题D' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '管理' }))
    expect(screen.getByText(/已选 0 条/)).toBeTruthy()
  })

  it('管理模式下只读记录没有复选框，且提示不参与删除', async () => {
    const writable = await seedCase('可写案例', 'cast', '2026-08-05T00:00:00.000Z')
    const fakeRepo = {
      listEntries: async () => [
        { mode: 'writable' as const, value: writable },
        { mode: 'readonly' as const, raw: { question: '旧版本卦例', schemaVersion: 999 }, reason: '数据来自更新版本的小工具' },
      ],
    } as unknown as CaseRepository

    const user = userEvent.setup()
    render(<HistoryPage repository={fakeRepo} onView={() => {}} onBack={() => {}} />)
    await screen.findByText('可写案例')

    await user.click(screen.getByRole('button', { name: '管理' }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByText(/另有 1 条只读记录不参与批量删除。/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '全选' }))
    expect(screen.getByText(/已选 1 条 \/ 可删 1 条/)).toBeTruthy()
  })

  it('没有可删记录时不渲染「管理」，不留点不动的灰按钮', async () => {
    const fakeRepo = {
      listEntries: async () => [
        { mode: 'readonly' as const, raw: { question: '旧版本卦例', schemaVersion: 999 }, reason: '数据来自更新版本的小工具' },
      ],
    } as unknown as CaseRepository

    render(<HistoryPage repository={fakeRepo} onView={() => {}} onBack={() => {}} />)
    expect((await screen.findAllByText(/只读/)).length).toBeGreaterThanOrEqual(1)

    expect(screen.queryByRole('button', { name: '管理' })).toBeNull()
    expect(screen.getByRole('button', { name: '展开备份与恢复' })).toBeTruthy()
  })
})

describe('首页最近卦例', () => {
  it('最近卦例读取期间显示加载反馈，不提前展示空态', async () => {
    let resolveCases!: (cases: DivinationCase[]) => void
    const pending = new Promise<DivinationCase[]>((resolve) => { resolveCases = resolve })
    const fakeRepo = { list: () => pending } as unknown as CaseRepository

    render(<HomePage repository={fakeRepo} onNavigate={() => {}} onViewCase={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('正在加载最近卦例')
    expect(screen.queryByText('还没有卦例，先从一次摇卦开始。')).toBeNull()

    resolveCases([])
    expect(await screen.findByText('还没有卦例，先从一次摇卦开始。')).toBeTruthy()
  })

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
