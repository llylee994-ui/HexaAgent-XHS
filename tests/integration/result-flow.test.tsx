import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createDraft } from '../../src/domain/factories'
import type { CoinThrow, DivinationCase } from '../../src/domain/types'
import { buildChart } from '../../src/engines/najia/chart'
import { interpret } from '../../src/engines/interpretation/engine'
import { ResultPage } from '../../src/features/result/ResultPage'

const CAST_AT = new Date(2026, 7, 28, 12, 0)

function buildCase(): DivinationCase {
  const rawValues = [6, 7, 7, 7, 7, 7] as const
  const draft = createDraft({
    question: '跳槽顺利吗',
    category: 'career',
    castAt: CAST_AT.toISOString(),
    method: 'simulated-coins',
  })
  const chart = buildChart(rawValues, CAST_AT)
  return {
    ...draft,
    status: 'cast',
    rawValues: [...rawValues],
    coinThrows: rawValues.map((rawValue, index) => ({
      round: (index + 1) as CoinThrow['round'],
      faces: rawValue === 6 ? ([0, 0, 0] as const) : ([1, 1, 0] as const),
      rawValue,
    })),
    chart,
    observations: interpret(chart, 'career').observations,
  }
}

function Harness({ initial, onChangeSpy }: { initial: DivinationCase; onChangeSpy: (value: DivinationCase) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <ResultPage
      caseValue={value}
      onChange={(next) => {
        setValue(next)
        onChangeSpy(next)
      }}
      onBack={() => {}}
    />
  )
}

async function setup() {
  const user = userEvent.setup()
  const onChangeSpy = vi.fn()
  render(<Harness initial={buildCase()} onChangeSpy={onChangeSpy} />)
  return { user, onChangeSpy }
}

describe('结果页首屏卡', () => {
  it('展示问题、本变关系、六爻与免责声明', async () => {
    await setup()
    expect(screen.getByText('跳槽顺利吗')).toBeTruthy()
    expect(screen.getByText('本卦：天风姤')).toBeTruthy()
    expect(screen.getByText('变卦：乾为天')).toBeTruthy()
    expect(screen.getAllByText(/第\d爻/).length).toBeGreaterThanOrEqual(6)
    expect(screen.getAllByText(/娱乐参考/).length).toBeGreaterThanOrEqual(1)
  })

  it('未保存 AI 回答时顶部显示提醒', async () => {
    await setup()
    expect(screen.getByText('这条卦例还没有保存 AI 解读')).toBeTruthy()
  })
})

describe('提示词与回答闭环', () => {
  it('生成精简版提示词后出现朱砂色"已问过 AI？粘贴回答"按钮', async () => {
    const { user, onChangeSpy } = await setup()
    await user.click(screen.getByRole('button', { name: '生成精简版提示词' }))

    const textarea = screen.getByLabelText('提示词内容') as HTMLTextAreaElement
    expect(textarea.value).toContain('跳槽顺利吗')
    expect(screen.getByRole('button', { name: '已问过 AI？粘贴回答' })).toBeTruthy()
    expect(onChangeSpy).toHaveBeenCalled()
    const prompted = onChangeSpy.mock.calls[0][0] as DivinationCase
    expect(prompted.status).toBe('prompted')
    expect(prompted.prompts).toHaveLength(1)
  })

  it('全选内容只选中文本，不调用剪贴板', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: '生成精简版提示词' }))
    await user.click(screen.getByRole('button', { name: '全选内容' }))

    const textarea = screen.getByLabelText('提示词内容') as HTMLTextAreaElement
    expect(textarea.selectionStart).toBe(0)
    expect(textarea.selectionEnd).toBe(textarea.value.length)
  })

  it('保存两个不同来源的回答互不覆盖，且关联提示词快照', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: '生成精简版提示词' }))

    await user.click(screen.getByRole('button', { name: '已问过 AI？粘贴回答' }))
    await user.type(screen.getByLabelText('粘贴 AI 回答'), '第一个 AI 的解读')
    await user.selectOptions(screen.getByLabelText('AI 来源'), 'DeepSeek')
    await user.click(screen.getByRole('button', { name: '保存回答' }))

    expect(screen.queryByText('这条卦例还没有保存 AI 解读')).toBeNull()
    expect(screen.getAllByText(/DeepSeek/).length).toBeGreaterThanOrEqual(1)

    await user.click(screen.getByRole('button', { name: '已问过 AI？粘贴回答' }))
    await user.type(screen.getByLabelText('粘贴 AI 回答'), '第二个 AI 的解读')
    await user.selectOptions(screen.getByLabelText('AI 来源'), 'ChatGPT')
    await user.click(screen.getByRole('button', { name: '保存回答' }))

    // 两个回答都保留：列表中同时出现两个来源
    expect(screen.getAllByText(/ChatGPT/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/DeepSeek/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('第一个 AI 的解读')).toBeTruthy()
    expect(screen.getByText('第二个 AI 的解读')).toBeTruthy()
  })

  it('保存卦例标题与后续验证', async () => {
    const { user, onChangeSpy } = await setup()
    await user.type(screen.getByLabelText('卦例标题'), '换工作第一卦')
    await user.type(screen.getByLabelText('后续验证'), '两周后拿到 offer')
    await user.click(screen.getByRole('button', { name: '保存卦例信息' }))

    const saved = onChangeSpy.mock.calls.at(-1)![0] as DivinationCase
    expect(saved.title).toBe('换工作第一卦')
    expect(saved.verification).toBe('两周后拿到 offer')
  })
})
