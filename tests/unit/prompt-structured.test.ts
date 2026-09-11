import { describe, expect, it } from 'vitest'
import { createDraft } from '../../src/domain/factories'
import type { DivinationCase } from '../../src/domain/types'
import { buildChart } from '../../src/engines/najia/chart'
import { generatePrompt } from '../../src/engines/prompt/engine'
import { buildStructuredPromptData } from '../../src/engines/prompt/structured'
import { formatReadableChart } from '../../src/engines/prompt/formatter'
import { beijing } from '../fixtures/beijing-time'

const CAST_AT = beijing('2026-08-28 12:00')

function buildCase(): DivinationCase {
  const rawValues = [6, 7, 7, 7, 7, 7] as const
  const draft = createDraft({
    question: '跳槽顺利吗',
    category: 'career',
    castAt: CAST_AT.toISOString(),
    method: 'manual',
  })
  const chart = buildChart(rawValues, CAST_AT, { lines: { 1: { liushen: '人工六神', fushen: { liuqin: '父母', zhi: '子' } } } })
  return { ...draft, status: 'cast', rawValues: [...rawValues], chart, observations: [] }
}

describe('structured professional prompt data', () => {
  it('orders readable and structured lines from upper to initial', () => {
    const value = buildCase()
    const structured = buildStructuredPromptData(value)
    expect(structured.original.lines.map((line) => line.position)).toEqual([6, 5, 4, 3, 2, 1])
    expect(formatReadableChart(value)[0]).toContain('上爻')
  })

  it('preserves correction metadata and fushen in the structured snapshot', () => {
    const line = buildStructuredPromptData(buildCase()).original.lines.at(-1)!
    expect(line.liushen).toBe('人工六神')
    expect(line.fushen).toEqual({ liuqin: '父母', zhi: '子' })
    expect(line.overriddenFields).toContain('liushen')
    expect(line.overriddenFields).toContain('fushen')
  })

  it('professional prompt contains parseable JSON equal to the case snapshot', () => {
    const value = buildCase()
    const content = generatePrompt(value, 'professional').content
    const json = content.split('```json\n')[1].split('\n```')[0]
    expect(JSON.parse(json)).toEqual(buildStructuredPromptData(value))
  })

  it('concise prompt does not include the structured JSON block', () => {
    expect(generatePrompt(buildCase(), 'concise').content).not.toContain('```json')
  })

  it('四柱被人工覆盖时结构化数据如实标记', () => {
    const value = buildCase()
    const overridden: DivinationCase = {
      ...value,
      chart: { ...value.chart!, sizhu: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' } },
    }
    expect(buildStructuredPromptData(overridden).sizhuOverridden).toBe(true)
    expect(generatePrompt(overridden, 'concise').content).toContain('（人工校正，非按起卦时间推算）')
    expect(buildStructuredPromptData(value).sizhuOverridden).toBe(false)
  })
})
