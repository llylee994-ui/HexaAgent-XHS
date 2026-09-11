import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createDraft } from '../../src/domain/factories'
import { buildChart } from '../../src/engines/najia/chart'
import { HeroCard } from '../../src/features/result/HeroCard'
import { AnswerPanel } from '../../src/features/result/AnswerPanel'
import type { DivinationCase } from '../../src/domain/types'

/** 绝对时刻 2026-09-11T12:34:00.000Z 在北京时间就是 20:34；旧实现会显示成 12:34 */
const INSTANT = '2026-09-11T12:34:00.000Z'
const BEIJING_TEXT = '2026-09-11 20:34'

function buildCase(): DivinationCase {
  const draft = createDraft({
    question: '时间显示检查',
    category: 'other',
    castAt: INSTANT,
    method: 'manual',
  })
  const rawValues = [7, 7, 7, 8, 8, 8] as const
  return {
    ...draft,
    status: 'answered',
    rawValues: [...rawValues],
    chart: buildChart(rawValues, INSTANT),
    prompts: [
      {
        id: 'prompt-1',
        variant: 'concise',
        version: '2.1.0',
        content: '占位提示词',
        createdAt: INSTANT,
      },
    ],
    answers: [
      { id: 'answer-1', source: 'DeepSeek', promptId: 'prompt-1', content: '占位回答', createdAt: INSTANT },
    ],
  }
}

describe('时间展示换算为北京时间', () => {
  it('结果卡显示北京时间并标注时区，不显示 UTC 墙钟', () => {
    render(<HeroCard caseValue={buildCase()} summary="摘要" disclaimers={['仅供参考']} />)
    expect(screen.getByText(new RegExp(BEIJING_TEXT))).toBeTruthy()
    expect(screen.getByText('仅供参考')).toBeTruthy()
    expect(document.body.textContent).not.toContain('12:34')
  })

  it('AI 回答时间同样按北京时间显示', () => {
    render(<AnswerPanel caseValue={buildCase()} promptId="prompt-1" open={false} onChange={() => {}} />)
    expect(screen.getByText(new RegExp(`${BEIJING_TEXT}`))).toBeTruthy()
    expect(document.body.textContent).not.toContain('12:34')
  })
})
