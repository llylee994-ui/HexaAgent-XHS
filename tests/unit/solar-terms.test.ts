import { describe, expect, it } from 'vitest'
import { SOLAR_TERM_FROM_YEAR, SOLAR_TERM_TO_YEAR } from '../../src/engines/calendar/solar-terms-data'
import { JIE_NAMES, jieAt, jieInstant, isWithinSupportedRange } from '../../src/engines/calendar/solar-terms'
import { CAST_TIME_ZONE, toZonedParts } from '../../src/engines/calendar/zoned-time'
import { HKO_JIE_BY_YEAR, HKO_JIE_NAMES } from '../fixtures/hko-solar-terms'

const OFFSET = CAST_TIME_ZONE.offsetMinutes

/** 交节时刻 → 北京时间墙上时刻的月/日/时/分 */
function wallClock(instant: number) {
  const parts = toZonedParts(instant, OFFSET)
  return { month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute }
}

describe('节气数据表与香港天文台公布值对照', () => {
  it('节气名称顺序与对照夹具一致', () => {
    expect([...JIE_NAMES]).toEqual([...HKO_JIE_NAMES])
  })

  it('2019–2028 年全部 12 节与天文台公布值逐项一致（容差 60 秒）', () => {
    const offenders: string[] = []
    let maxDeltaSeconds = 0
    for (const [yearText, published] of Object.entries(HKO_JIE_BY_YEAR)) {
      const year = Number(yearText)
      published.forEach((expected, index) => {
        const actual = wallClock(jieInstant(year, index))
        const publishedMinutes = Date.UTC(year, expected.month - 1, expected.day) / 60_000 + expected.hour * 60 + expected.minute
        const actualMinutes = Date.UTC(year, actual.month - 1, actual.day) / 60_000 + actual.hour * 60 + actual.minute
        const deltaSeconds = Math.abs(actualMinutes - publishedMinutes) * 60
        maxDeltaSeconds = Math.max(maxDeltaSeconds, deltaSeconds)
        if (deltaSeconds > 60) {
          offenders.push(
            `${year} ${JIE_NAMES[index]}：公布 ${expected.month}/${expected.day} ${expected.hour}:${expected.minute}，` +
              `本项目 ${actual.month}/${actual.day} ${actual.hour}:${actual.minute}`,
          )
        }
      })
    }
    expect(offenders).toEqual([])
    // 差异只可能来自公布值的取整方向与星历精度，不应超过 1 分钟
    expect(maxDeltaSeconds).toBeLessThanOrEqual(60)
  })

  it('数据表覆盖范围含 1899（供 1900 年 1 月回退）到 2100', () => {
    expect(SOLAR_TERM_FROM_YEAR).toBe(1899)
    expect(SOLAR_TERM_TO_YEAR).toBe(2100)
  })
})

describe('jieAt 归属判断', () => {
  it('月支索引：立春属寅月（0）、小寒属丑月（11）、大雪属子月（10）', () => {
    const liChun = jieAt(jieInstant(2026, 1))
    expect(liChun.index).toBe(1)
    expect(liChun.monthBranchIndex).toBe(0)
    expect(liChun.springYear).toBe(2026)

    const xiaoHan = jieAt(jieInstant(2026, 0))
    expect(xiaoHan.monthBranchIndex).toBe(11)
    expect(xiaoHan.springYear).toBe(2025)

    const daXue = jieAt(jieInstant(2026, 11))
    expect(daXue.monthBranchIndex).toBe(10)
    expect(daXue.springYear).toBe(2026)
  })

  it('交节时刻当刻即属新月', () => {
    const instant = jieInstant(2026, 7) // 立秋
    expect(jieAt(instant).index).toBe(7)
    expect(jieAt(instant - 1).index).toBe(6)
  })

  it('1900 年 1 月小寒之前回退到 1899 年的大雪（子月）', () => {
    const match = jieAt('1900-01-01T00:00:00.000Z')
    expect(match.year).toBe(1899)
    expect(match.index).toBe(11)
    expect(match.monthBranchIndex).toBe(10)
  })

  it('1900–2100 之外抛出支持范围错误', () => {
    expect(() => jieAt('1898-01-01T00:00:00.000Z')).toThrow(/支持范围/)
    expect(() => jieAt('2101-01-01T00:00:00.000Z')).toThrow(/支持范围/)
  })

  it('isWithinSupportedRange 用于界面预校验', () => {
    expect(isWithinSupportedRange('2026-09-11T12:34:00.000Z')).toBe(true)
    expect(isWithinSupportedRange('2101-01-01T00:00:00.000Z')).toBe(false)
    expect(isWithinSupportedRange('rubbish')).toBe(false)
  })
})
