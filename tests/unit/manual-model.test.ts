import { describe, expect, it } from 'vitest'
import type { ManualEditorState } from '../../src/features/manual/model'
import type { ChartOverrides } from '../../src/engines/najia/chart'
import { buildChart } from '../../src/engines/najia/chart'
import {
  buildManualChart,
  clearLineOverride,
  clearTimeDependentOverrides,
  lineFromRawValue,
  rawValueFromLine,
  rawValuesForHexagram,
  searchHexagrams,
  validateManualState,
} from '../../src/features/manual/model'

const CAST_AT = new Date('2026-08-31T03:00:00.000Z')

function buildValidManualState(overrides: Partial<ManualEditorState> = {}): ManualEditorState {
  return {
    question: '这次合作是否适合推进？',
    category: 'career',
    note: '',
    castAt: CAST_AT.toISOString(),
    rawValues: [7, 7, 7, 8, 8, 8],
    overrides: {},
    selectedHexagramName: '地天泰',
    ...overrides,
  }
}

describe('手动排盘纯模型', () => {
  it.each([
    ['yin', true, 6],
    ['yang', false, 7],
    ['yin', false, 8],
    ['yang', true, 9],
  ] as const)('maps %s changing=%s to raw value %s', (type, changing, expected) => {
    expect(rawValueFromLine(type, changing)).toBe(expected)
  })

  it('maps an internal raw value back to visible yin-yang and changing state', () => {
    expect(lineFromRawValue(6)).toEqual({ type: 'yin', changing: true })
    expect(lineFromRawValue(9)).toEqual({ type: 'yang', changing: true })
  })

  it('finds 地天泰 by full name and by 泰', () => {
    expect(searchHexagrams('地天泰').map((item) => item.name)).toEqual(['地天泰'])
    expect(searchHexagrams('泰').map((item) => item.name)).toContain('地天泰')
  })

  it('creates the static 地天泰 lines without exposing coin values to the UI', () => {
    expect(rawValuesForHexagram('地天泰')).toEqual([7, 7, 7, 8, 8, 8])
  })

  it('applies and records a manual fushen correction', () => {
    const chart = buildChart([7, 7, 7, 8, 8, 8], CAST_AT, {
      lines: { 1: { fushen: { liuqin: '父母', zhi: '亥' } } },
    })
    expect(chart.original.lines[0].fushen).toEqual({ liuqin: '父母', zhi: '亥' })
    expect(chart.original.lines[0].overriddenFields).toContain('fushen')
  })

  it('keeps fushen corrections on the original figure only', () => {
    const chart = buildChart([9, 7, 7, 8, 8, 8], CAST_AT, {
      lines: { 1: { fushen: { liuqin: '父母', zhi: '亥' } } },
    })
    expect(chart.changed).not.toBeNull()
    expect(chart.changed!.lines[0].fushen).toBeNull()
  })

  it('requires exactly one shi and one ying in the final chart', () => {
    const state = buildValidManualState({
      overrides: { lines: { 1: { shiYing: 'shi' }, 2: { shiYing: 'shi' } } },
    })
    expect(validateManualState(state)).toContainEqual(
      expect.objectContaining({ section: 'lines', field: 'shiYing' }),
    )
  })

  it('restores automatic values when a line override is cleared', () => {
    const overrides: ChartOverrides = { lines: { 1: { liushen: '玄武', fushen: { liuqin: '兄弟', zhi: '子' } } } }
    expect(clearLineOverride(overrides, 1)).toEqual({ lines: {} })
    expect(buildManualChart(buildValidManualState({ overrides: { lines: { 1: { liushen: '玄武' } } } })).original.lines[0].liushen).toBe('玄武')
  })
})

describe('起卦时间变化后的覆盖一致性', () => {
  const sizhuOverride = { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' }

  it('清除四柱与爻级旬空覆盖，保留与时间无关的爻级覆盖', () => {
    const overrides: ChartOverrides = {
      sizhu: sizhuOverride,
      lines: { 1: { xunKong: true, liushen: '玄武' }, 2: { zhi: '子' } },
    }
    expect(clearTimeDependentOverrides(overrides)).toEqual({
      lines: { 1: { liushen: '玄武' }, 2: { zhi: '子' } },
    })
  })

  it('覆盖全部与时间相关时返回空覆盖', () => {
    expect(clearTimeDependentOverrides({ sizhu: sizhuOverride, lines: { 1: { xunKong: false } } })).toEqual({})
    expect(clearTimeDependentOverrides({})).toEqual({})
  })

  it('改时间后四柱按新时间重算，不残留旧覆盖', () => {
    const state = buildValidManualState({ castAt: '2026-08-31T03:00:00.000Z', overrides: { sizhu: sizhuOverride } })
    expect(buildManualChart(state).sizhu.year).toBe('甲子')

    const afterTimeChange = {
      ...state,
      castAt: '2026-08-31T05:00:00.000Z',
      overrides: clearTimeDependentOverrides(state.overrides),
    }
    expect(buildManualChart(afterTimeChange).sizhu.year).toBe('丙午')
  })

  it('超出支持范围的起卦时间给出可读错误，不静默降级', () => {
    const state = buildValidManualState({ castAt: '2101-01-01T00:00:00.000Z' })
    expect(() => buildManualChart(state)).toThrow(/支持范围/)
    expect(validateManualState(state)).toContainEqual(
      expect.objectContaining({ section: 'sizhu', message: expect.stringContaining('支持范围') }),
    )
  })
})
