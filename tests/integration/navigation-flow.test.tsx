import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DivinationCase } from '../../src/domain/types'
import { createDraft } from '../../src/domain/factories'
import { buildChart } from '../../src/engines/najia/chart'
import App from '../../src/app/App'
import { createCaseRepository } from '../../src/storage/case-db'
import { draftStore } from '../../src/storage/draft-store'
import { beijing } from '../fixtures/beijing-time'

const CAST_AT = beijing('2026-08-28 12:00')
const repository = createCaseRepository()

async function putCase(overrides: Partial<DivinationCase> = {}): Promise<DivinationCase> {
  const draft = createDraft({
    question: '考试是否顺利？',
    category: 'study',
    castAt: CAST_AT.toISOString(),
    method: 'simulated-coins',
  })
  const value: DivinationCase = {
    ...draft,
    status: 'cast',
    rawValues: [6, 7, 7, 7, 7, 7],
    chart: buildChart([6, 7, 7, 7, 7, 7], CAST_AT),
    ...overrides,
  }
  await repository.put(value)
  return value
}

beforeEach(async () => {
  localStorage.clear()
  for (const value of await repository.list()) {
    await repository.delete(value.id)
  }
})

/** 走完一次手动排盘录入，停在“生成正式结果”之前 */
async function enterManualChart(user: ReturnType<typeof userEvent.setup>, question: string) {
  await user.click(screen.getByRole('button', { name: '手动排盘' }))
  await user.type(screen.getByLabelText('你的问题'), question)
  await user.selectOptions(screen.getByLabelText('问题类别'), 'career')
  await user.click(screen.getByRole('button', { name: '下一步' }))
  await user.type(screen.getByRole('combobox', { name: '搜索卦名' }), '泰')
  await user.click(screen.getByRole('option', { name: '地天泰' }))
}

describe('应用内导航栈', () => {
  it('从手动排盘返回上一页而不退出应用', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '手动排盘' }))
    expect(screen.getByRole('heading', { name: '手动排盘' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回' }))
    expect(screen.getByRole('heading', { name: '问爻' })).toBeInTheDocument()
    // 应用仍在栈内，可以再次进入
    expect(screen.getByRole('button', { name: '手动排盘' })).toBeInTheDocument()
  })

  it('查看结果后返回历史页，搜索条件被恢复', async () => {
    await putCase({ title: '考试第一卦' })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '卦例记录' }))
    await screen.findByText('考试第一卦')
    await user.type(screen.getByLabelText('搜索卦例'), '考试')
    await screen.findByText('考试第一卦')
    await user.click(screen.getByRole('button', { name: /考试第一卦/ }))
    expect(screen.getByText('本卦：天风姤', { exact: true })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回' }))
    expect(screen.getByRole('heading', { name: '卦例记录' })).toBeInTheDocument()
    expect(screen.getByLabelText('搜索卦例')).toHaveValue('考试')
  })

  it('浏览器系统返回映射为一次应用内返回', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '现场摇卦' }))
    expect(screen.getByRole('heading', { name: '现场摇卦' })).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByRole('heading', { name: '问爻' })).toBeInTheDocument()
  })

  it('首页时系统返回不再弹出栈', async () => {
    render(<App />)

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByRole('heading', { name: '问爻' })).toBeInTheDocument()
  })
})

describe('手动排盘草稿的生命周期', () => {
  it('生成正式结果后返回结果页上一层，草稿被恢复以便继续校正', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterManualChart(user, '第一轮的问题')

    await user.click(screen.getByRole('button', { name: '生成正式结果' }))
    expect(screen.getByRole('heading', { name: '排盘结果' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回', exact: true }))

    expect(screen.getByLabelText('你的问题')).toHaveValue('第一轮的问题')
    expect(screen.getByText('本卦：地天泰')).toBeInTheDocument()
    // 已完成的一轮是"返回校正"，不是"上次未完成的草稿"，不能弹恢复提示
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('已生成结果的草稿不再带进下一次进入，重新进入是全新一轮', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterManualChart(user, '第一轮的问题')

    await user.click(screen.getByRole('button', { name: '生成正式结果' }))
    await user.click(screen.getByRole('button', { name: '返回首页' }))

    await user.click(screen.getByRole('button', { name: '手动排盘' }))

    // 回到问题填写步，且没有任何上一轮的残留
    expect(screen.getByLabelText('你的问题')).toHaveValue('')
    expect(screen.queryByText('本卦：地天泰')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下一步' })).toBeInTheDocument()
  })

  it('未生成结果的草稿在返回首页后仍能恢复，不静默丢弃', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterManualChart(user, '没写完的问题')

    await user.click(screen.getByRole('button', { name: '返回' }))
    await user.click(screen.getByRole('button', { name: '手动排盘' }))

    expect(screen.getByLabelText('你的问题')).toHaveValue('没写完的问题')
    expect(screen.getByRole('status')).toHaveTextContent('已恢复上次未完成的卦')
  })

  it('确认开始新一卦只清手动草稿，现场摇卦草稿保持不动', async () => {
    const user = userEvent.setup()
    const castDraft = createDraft({
      question: '现场摇卦的草稿',
      category: 'career',
      castAt: CAST_AT.toISOString(),
      method: 'simulated-coins',
    })
    draftStore.save({ ...castDraft, rawValues: [7] })

    render(<App />)
    await enterManualChart(user, '没写完的问题')
    await user.click(screen.getByRole('button', { name: '返回' }))
    await user.click(screen.getByRole('button', { name: '手动排盘' }))

    await user.click(screen.getByRole('button', { name: '开始新一卦' }))
    await user.click(screen.getByRole('button', { name: '清空并重新开始' }))

    expect(screen.getByLabelText('你的问题')).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(draftStore.load()?.question).toBe('现场摇卦的草稿')
  })
})

describe('容器限制下的导航降级', () => {
  it('history API 被禁用时应用内导航与返回仍然可用', async () => {
    // 关键回归：容器沙箱里 pushState 抛 SecurityError，旧实现会让所有导航按钮点了没反应
    const pushState = vi.spyOn(window.history, 'pushState').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    try {
      const user = userEvent.setup()
      render(<App />)

      await user.click(screen.getByRole('button', { name: '现场摇卦' }))
      expect(screen.getByLabelText('你的问题')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '返回' }))
      expect(screen.getByRole('heading', { name: '问爻' })).toBeInTheDocument()

      // pushState 已失败，就不能再调 history.back()——浏览器历史里没有我们的记录，
      // 那一步会把容器里的页面真的退出去
      expect(historyBack).not.toHaveBeenCalled()
    } finally {
      pushState.mockRestore()
      historyBack.mockRestore()
    }
  })

  it('草稿写入失败（容器禁用 localStorage）不影响流程推进', async () => {
    const user = userEvent.setup()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    try {
      render(<App />)

      await user.click(screen.getByRole('button', { name: '现场摇卦' }))
      await user.type(screen.getByLabelText('你的问题'), '存储不可用也要能继续')
      await user.selectOptions(screen.getByLabelText('问题类别'), 'other')
      await user.click(screen.getByRole('button', { name: '下一步' }))

      // 旧实现里草稿写入异常会从 effect 抛出并卸载整棵树，这一步之后页面会变成空白
      expect(screen.getByRole('button', { name: '模拟铜钱摇卦' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: '选择起卦方式' })).toBeInTheDocument()
    } finally {
      setItem.mockRestore()
    }
  })
})
