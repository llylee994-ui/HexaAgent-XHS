import { describe, expect, it } from 'vitest'
import { createDraft } from '../../src/domain/factories'
import type { CoinThrow, DivinationCase } from '../../src/domain/types'
import { PROMPT_VERSION } from '../../src/domain/versions'
import { buildChart } from '../../src/engines/najia/chart'
import { interpret } from '../../src/engines/interpretation/engine'
import { generatePrompt } from '../../src/engines/prompt/engine'

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

describe('generatePrompt 精简版', () => {
  it('快照带 PROMPT_VERSION 与完整文本', () => {
    const snapshot = generatePrompt(buildCase(), 'concise')
    expect(snapshot.version).toBe(PROMPT_VERSION)
    expect(snapshot.variant).toBe('concise')
    expect(snapshot.content.length > 0).toBe(true)
    expect(snapshot.id.length > 0).toBe(true)
    expect(new Date(snapshot.createdAt).valueOf()).not.toBeNaN()
  })

  it('包含问题、起卦时间、本卦、变卦、动爻与关键排盘', () => {
    const content = generatePrompt(buildCase(), 'concise').content
    expect(content).toContain('跳槽顺利吗')
    expect(content).toContain('2026')
    expect(content).toContain('天风姤')
    expect(content).toContain('乾为天')
    expect(content).toContain('动爻')
    expect(content).toContain('第1爻')
    expect(content).toContain('旬空')
  })

  it('精简版不包含原始投币与逐条规则依据', () => {
    const content = generatePrompt(buildCase(), 'concise').content
    expect(content).not.toContain('原始投币')
    expect(content).not.toContain('yongshen')
  })
})

describe('generatePrompt 专业版', () => {
  const content = generatePrompt(buildCase(), 'professional').content

  it('包含原始投币、四柱与六爻全部字段', () => {
    expect(content).toContain('原始投币')
    expect(content).toContain('反反反')
    expect(content).toContain('丙午年')
    expect(content).toContain('甲戌日')
    expect(content).toContain('青龙')
    expect(content).toContain('辛丑')
    expect(content).toContain('父母')
    expect(content).toContain('世')
    expect(content).toContain('伏神')
  })

  it('包含离线规则观察及其依据', () => {
    expect(content).toContain('yongshen-visibility')
    expect(content).toContain('依据')
  })

  it('包含对外部 AI 的七条输出约束', () => {
    expect(content).toContain('先确认用神选择')
    expect(content).toContain('逐条引用卦象数据')
    expect(content).toContain('区分本卦、动爻和变卦')
    expect(content).toContain('不编造未提供的数据')
    expect(content).toContain('不确定性')
    expect(content).toContain('通俗语言总结')
    expect(content).toContain('健康、法律和财务')
    const numbered = content.split('\n').filter((line) => /^\d\./.test(line.trim()))
    expect(numbered).toHaveLength(7)
  })
})
