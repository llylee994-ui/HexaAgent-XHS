import { describe, expect, it } from 'vitest'
import { TRIGRAMS, trigramLines, findTrigramByLines } from '../../src/engines/hexagram/trigrams'
import { HEXAGRAM_TABLE, findHexagramEntry } from '../../src/engines/hexagram/table'
import { buildHexagram, identifyHexagram } from '../../src/engines/hexagram/engine'
import { FIXED_HEXAGRAM_CASES } from '../fixtures/hexagram-cases'

describe('trigrams', () => {
  it('八个三画卦爻象与来源项目一致', () => {
    expect(trigramLines('乾')).toEqual(['yang', 'yang', 'yang'])
    expect(trigramLines('兑')).toEqual(['yang', 'yang', 'yin'])
    expect(trigramLines('离')).toEqual(['yang', 'yin', 'yang'])
    expect(trigramLines('震')).toEqual(['yang', 'yin', 'yin'])
    expect(trigramLines('巽')).toEqual(['yin', 'yang', 'yang'])
    expect(trigramLines('坎')).toEqual(['yin', 'yang', 'yin'])
    expect(trigramLines('艮')).toEqual(['yin', 'yin', 'yang'])
    expect(trigramLines('坤')).toEqual(['yin', 'yin', 'yin'])
  })

  it('三爻反查卦名，且八卦五行正确', () => {
    expect(findTrigramByLines(['yang', 'yang', 'yang'])).toBe('乾')
    expect(findTrigramByLines(['yin', 'yin', 'yang'])).toBe('艮')
    expect(TRIGRAMS.map((t) => t.element)).toEqual(['金', '金', '火', '木', '木', '水', '土', '土'])
  })
})

describe('hexagram table', () => {
  it('包含全部 64 卦', () => {
    expect(HEXAGRAM_TABLE.size).toBe(64)
  })

  it('64 个上下卦组合都有卦名，且卦名互不重复', () => {
    const names = new Set<string>()
    for (const upper of TRIGRAMS.map((t) => t.name)) {
      for (const lower of TRIGRAMS.map((t) => t.name)) {
        const entry = findHexagramEntry(upper, lower)
        expect(entry, `${upper}下${lower} 缺少卦名`).toBeDefined()
        names.add(entry!.name)
      }
    }
    expect(names.size).toBe(64)
  })

  it('卦宫五行由卦宫卦名五行决定', () => {
    expect(findHexagramEntry('乾', '乾')!.palaceElement).toBe('金')
    expect(findHexagramEntry('坤', '坤')!.palaceElement).toBe('土')
    expect(findHexagramEntry('坎', '坎')!.palaceElement).toBe('水')
    expect(findHexagramEntry('离', '离')!.palaceElement).toBe('火')
    expect(findHexagramEntry('震', '震')!.palaceElement).toBe('木')
  })
})

describe('identifyHexagram', () => {
  it('六爻皆阳识别为乾为天，世爻在上爻', () => {
    const identity = identifyHexagram(['yang', 'yang', 'yang', 'yang', 'yang', 'yang'])
    expect(identity.name).toBe('乾为天')
    expect(identity.upperTrigram).toBe('乾')
    expect(identity.lowerTrigram).toBe('乾')
    expect(identity.palace).toBe('乾')
    expect(identity.shiPosition).toBe(6)
  })

  it('天风姤为乾上巽下，世爻在初爻', () => {
    const identity = identifyHexagram(['yin', 'yang', 'yang', 'yang', 'yang', 'yang'])
    expect(identity.name).toBe('天风姤')
    expect(identity.upperTrigram).toBe('乾')
    expect(identity.lowerTrigram).toBe('巽')
    expect(identity.palace).toBe('乾')
    expect(identity.shiPosition).toBe(1)
  })

  it('游魂卦火地晋世在四爻，归魂卦火天大有世在三爻', () => {
    expect(identifyHexagram(['yin', 'yin', 'yin', 'yang', 'yin', 'yang']).shiPosition).toBe(4)
    expect(identifyHexagram(['yang', 'yang', 'yang', 'yang', 'yin', 'yang']).shiPosition).toBe(3)
  })

  it('爻数不为六时抛出错误', () => {
    expect(() => identifyHexagram(['yang', 'yin'])).toThrow()
  })
})

describe('buildHexagram', () => {
  it('固定案例集的本卦、变卦、动爻和卦宫全部匹配', () => {
    for (const fixture of FIXED_HEXAGRAM_CASES) {
      const chart = buildHexagram(fixture.rawValues)
      expect(chart.original.name, fixture.name).toBe(fixture.originalName)
      expect(chart.original.palace, fixture.name).toBe(fixture.originalPalace)
      expect(chart.changingLines, fixture.name).toEqual([...fixture.changingLines])
      expect(
        chart.changed?.name ?? null,
        fixture.name,
      ).toBe(fixture.changedName)
    }
  })

  it('静卦没有变卦', () => {
    const chart = buildHexagram([7, 7, 7, 7, 7, 7])
    expect(chart.changed).toBeNull()
    expect(chart.changingLines).toEqual([])
    expect(chart.allChanging).toBe(false)
  })

  it('六爻皆动时标记 allChanging 并生成完整变卦', () => {
    const chart = buildHexagram([6, 6, 6, 6, 6, 6])
    expect(chart.allChanging).toBe(true)
    expect(chart.changingLines).toEqual([1, 2, 3, 4, 5, 6])
    expect(chart.changed?.name).toBe('乾为天')
    expect(chart.changed?.lines).toHaveLength(6)
  })

  it('只有 6 和 9 翻转，7 和 8 保持不变', () => {
    const chart = buildHexagram([7, 8, 8, 8, 8, 8])
    expect(chart.changed).toBeNull()

    const changed = buildHexagram([9, 8, 8, 8, 8, 8])
    expect(changed.changingLines).toEqual([1])
    expect(changed.original.lines[0].changing).toBe(true)
    expect(changed.original.lines[1].changing).toBe(false)
  })

  it('变卦六爻均为完整数据且不再带动爻', () => {
    const chart = buildHexagram([6, 7, 7, 7, 7, 7])
    const changed = chart.changed!
    expect(changed.name).toBe('乾为天')
    for (const line of changed.lines) {
      expect(line.type).toBe('yang')
      expect(line.changing).toBe(false)
    }
  })

  it('爻值超出 6..9 或长度不为六时抛出错误', () => {
    expect(() => buildHexagram([5, 7, 7, 7, 7, 7])).toThrow()
    expect(() => buildHexagram([7, 7, 7, 7, 7])).toThrow()
  })
})
