import { describe, expect, it } from 'vitest'
import { createDraft } from '../../src/domain/factories'
import type { CoinThrow, DivinationCase } from '../../src/domain/types'
import { PROMPT_VERSION } from '../../src/domain/versions'
import { buildChart } from '../../src/engines/najia/chart'
import { interpret } from '../../src/engines/interpretation/engine'
import { generatePrompt } from '../../src/engines/prompt/engine'
import { beijing } from '../fixtures/beijing-time'

const CAST_AT = beijing('2026-08-28 12:00')

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

describe('generatePrompt 起卦时间与时区', () => {
  it('文字时间按北京时间输出并标注时区，不出现裸 UTC 时刻', () => {
    const content = generatePrompt(buildCase(), 'concise').content
    // CAST_AT 的墙上时刻即北京时间 2026-08-28 12:00（绝对时刻 04:00Z）
    expect(content).toContain('起卦时间：2026-08-28 12:00（北京时间 UTC+8）')
    expect(content).toContain('排盘时区：Asia/Shanghai（UTC+8）')
    expect(content).not.toContain('2026-08-28T04:00:00.000Z')
  })

  it('声明排盘规则，供外部 AI 复核四柱', () => {
    const content = generatePrompt(buildCase(), 'concise').content
    expect(content).toContain('排盘规则：年柱以立春、月柱以十二"节"的交节时刻为界')
    expect(content).toContain('23:00 起子时，且 23:00-23:59 不换日柱')
    expect(content).toContain('未做真太阳时校正')
  })

  it('节气来源表述与实际实现一致，不再声称直接取自香港天文台', () => {
    const concise = generatePrompt(buildCase(), 'concise').content
    const professional = generatePrompt(buildCase(), 'professional').content
    for (const content of [concise, professional]) {
      expect(content).toContain('内置离线节气表')
      expect(content).toContain('寿星万年历算法生成')
      expect(content).toContain('2019–2028 年的十二节与香港天文台公布值核对')
      expect(content).not.toContain('交节时刻取香港天文台公布值')
    }
  })

  it('提示词文字与结构化 JSON 表达同一节气来源事实', () => {
    const professional = generatePrompt(buildCase(), 'professional').content
    const json = JSON.parse(professional.split('```json\n')[1].split('\n```')[0])
    expect(json.rules.solarTermSource).toContain('内置离线节气表')
    expect(json.rules.solarTermSource).toContain('2019–2028 年的十二节与香港天文台公布值核对')
    expect(json.rules.solarTermSource).not.toContain('香港天文台公布的二十四节气交节时刻')
  })

  it('提示词中的本地时间与绝对时刻互为逆运算（两者不会各自漂移）', () => {
    const value = buildCase()
    const content = generatePrompt(value, 'professional').content
    const matched = /起卦时间：(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})（北京时间 UTC\+8）/.exec(content)
    expect(matched).not.toBeNull()
    const [, day, clock] = matched!
    const instant = Date.parse(`${day}T${clock}:00.000+08:00`)
    expect(new Date(instant).toISOString()).toBe(value.castAt)
  })

  it('专业版 JSON 带上本地时间、时区与规则，且四柱未被标记为人工校正', () => {
    const value = buildCase()
    const content = generatePrompt(value, 'professional').content
    const json = JSON.parse(content.split('```json\n')[1].split('\n```')[0])
    expect(json.castAtLocal).toBe('2026-08-28 12:00')
    expect(json.timeZone).toEqual({ id: 'Asia/Shanghai', label: '北京时间', offsetMinutes: 480 })
    expect(json.rules.ziHourRule).toBe('no-day-rollover')
    expect(json.rules.trueSolarTime).toBe(false)
    expect(json.sizhuOverridden).toBe(false)
  })
})

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
