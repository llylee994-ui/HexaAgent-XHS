import { describe, expect, it } from 'vitest'
import {
  HEXAGRAM_CLASSICS,
  getHexagramClassic,
  getRelevantClassicLines,
} from '../../src/content/classics'
import { HEXAGRAM_TABLE } from '../../src/engines/hexagram/table'

describe('经典文本查询', () => {
  it('未知卦名安全返回空结果', () => {
    expect(getHexagramClassic('不存在的卦')).toBeNull()
    expect(getRelevantClassicLines('不存在的卦', [1])).toEqual([])
  })

  it('动爻位置去重并按初爻到上爻返回', () => {
    const lines = getRelevantClassicLines('乾为天', [6, 1, 1])

    expect(lines.map((line) => line.label)).toEqual(['初九', '上九'])
    expect(lines.map((line) => line.position)).toEqual([1, 6])
  })

  it('完整覆盖引擎中的六十四卦和每卦六爻', () => {
    const engineNames = new Set(
      [...HEXAGRAM_TABLE.values()].map((entry) => entry.name),
    )

    expect(HEXAGRAM_CLASSICS).toHaveLength(64)
    expect(HEXAGRAM_CLASSICS.map((item) => item.sequence)).toEqual(
      Array.from({ length: 64 }, (_, index) => index + 1),
    )
    expect(new Set(HEXAGRAM_CLASSICS.map((item) => item.name))).toEqual(
      engineNames,
    )

    for (const item of HEXAGRAM_CLASSICS) {
      expect(item.lines.map((line) => line.position)).toEqual([1, 2, 3, 4, 5, 6])
      expect(item.judgement.original.trim()).not.toBe('')
      expect(item.judgement.plain.trim()).not.toBe('')

      for (const line of item.lines) {
        expect(line.label.trim()).not.toBe('')
        expect(line.original.trim()).not.toBe('')
        expect(line.plain.trim()).not.toBe('')
      }
    }
  })

  it('只为乾坤保留用九与用六', () => {
    expect(getHexagramClassic('乾为天')?.special?.kind).toBe('use-nine')
    expect(getHexagramClassic('坤为地')?.special?.kind).toBe('use-six')

    const otherSpecials = HEXAGRAM_CLASSICS
      .filter((item) => item.name !== '乾为天' && item.name !== '坤为地')
      .filter((item) => item.special !== null)
    expect(otherSpecials).toEqual([])
  })

  it('白话均为独立解释且不含确定性禁语', () => {
    const banned = /保证|必然|一定成功|一定失败|确诊/

    for (const item of HEXAGRAM_CLASSICS) {
      const passages = [item.judgement, ...item.lines]
      if (item.special) passages.push(item.special)

      for (const passage of passages) {
        expect(passage.plain.trim()).not.toBe(passage.original.trim())
        expect(passage.plain).not.toMatch(banned)
      }
    }
  })
})
