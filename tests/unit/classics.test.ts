import { describe, expect, it } from 'vitest'
import {
  getHexagramClassic,
  getRelevantClassicLines,
} from '../../src/content/classics'

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
})
