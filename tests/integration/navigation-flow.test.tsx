import { act } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DivinationCase } from '../../src/domain/types'
import { createDraft } from '../../src/domain/factories'
import { buildChart } from '../../src/engines/najia/chart'
import App from '../../src/app/App'
import { createCaseRepository } from '../../src/storage/case-db'

const CAST_AT = new Date(2026, 7, 28, 12, 0)
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
  for (const value of await repository.list()) {
    await repository.delete(value.id)
  }
})

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
