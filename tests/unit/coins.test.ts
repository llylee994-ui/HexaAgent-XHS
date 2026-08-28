import { describe, expect, it } from 'vitest'
import { facesToRawValue, rawValueToLine, throwCoins } from '../../src/engines/divination/coins'

describe('facesToRawValue', () => {
  // 约定：正面(1)记 3，反面(0)记 2，三枚之和为爻值
  it('三反为 6 老阴', () => {
    expect(facesToRawValue([0, 0, 0])).toBe(6)
  })

  it('两反一正为 7 少阳（与顺序无关）', () => {
    expect(facesToRawValue([1, 0, 0])).toBe(7)
    expect(facesToRawValue([0, 1, 0])).toBe(7)
    expect(facesToRawValue([0, 0, 1])).toBe(7)
  })

  it('一反两正为 8 少阴（与顺序无关）', () => {
    expect(facesToRawValue([1, 1, 0])).toBe(8)
    expect(facesToRawValue([1, 0, 1])).toBe(8)
    expect(facesToRawValue([0, 1, 1])).toBe(8)
  })

  it('三正为 9 老阳', () => {
    expect(facesToRawValue([1, 1, 1])).toBe(9)
  })
})

describe('rawValueToLine', () => {
  it('6 老阴：阴爻动', () => {
    expect(rawValueToLine(6)).toEqual({ type: 'yin', changing: true })
  })

  it('7 少阳：阳爻不动', () => {
    expect(rawValueToLine(7)).toEqual({ type: 'yang', changing: false })
  })

  it('8 少阴：阴爻不动', () => {
    expect(rawValueToLine(8)).toEqual({ type: 'yin', changing: false })
  })

  it('9 老阳：阳爻动', () => {
    expect(rawValueToLine(9)).toEqual({ type: 'yang', changing: true })
  })
})

describe('throwCoins', () => {
  it('默认使用 Math.random 产生合法爻面', () => {
    const faces = throwCoins()
    expect(faces).toHaveLength(3)
    for (const face of faces) {
      expect(face === 0 || face === 1).toBe(true)
    }
  })

  it('注入伪随机序列得到可重复结果', () => {
    // 每枚铜钱消费一次 random：< 0.5 为正面(1)，>= 0.5 为反面(0)
    const sequence = [0.1, 0.9, 0.3, 0.5, 0.49, 0.99]
    let cursor = 0
    const random = () => sequence[cursor++]

    expect(throwCoins(random)).toEqual([1, 0, 1])
    expect(throwCoins(random)).toEqual([0, 1, 0])
  })

  it('相同伪随机序列产出相同爻值', () => {
    const makeRandom = () => {
      const sequence = [0.2, 0.8, 0.4]
      let cursor = 0
      return () => sequence[cursor++]
    }

    const first = facesToRawValue(throwCoins(makeRandom()))
    const second = facesToRawValue(throwCoins(makeRandom()))
    expect(first).toBe(second)
  })
})
