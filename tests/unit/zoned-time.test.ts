import { describe, expect, it } from 'vitest'
import {
  CAST_TIME_ZONE,
  formatUtcOffset,
  formatZonedDateTime,
  formatZonedTimestamp,
  formatZoneLabel,
  fromZonedParts,
  parseZonedInput,
  toZonedInputValue,
  toZonedParts,
} from '../../src/engines/calendar/zoned-time'

const OFFSET = CAST_TIME_ZONE.offsetMinutes
const INSTANT = '2026-09-11T12:34:00.000Z'

describe('toZonedParts / fromZonedParts', () => {
  it('绝对时刻换成北京时间墙上时刻', () => {
    expect(toZonedParts(INSTANT, OFFSET)).toEqual({
      year: 2026,
      month: 9,
      day: 11,
      hour: 20,
      minute: 34,
      second: 0,
    })
  })

  it('跨日：UTC 16:30 已是北京时间次日 00:30', () => {
    expect(toZonedParts('2026-09-11T16:30:00.000Z', OFFSET)).toMatchObject({ day: 12, hour: 0, minute: 30 })
  })

  it('闰日：2028-02-29 北京时间 00:00', () => {
    expect(toZonedParts('2028-02-28T16:00:00.000Z', OFFSET)).toMatchObject({ year: 2028, month: 2, day: 29 })
  })

  it('月末与年末：UTC 12-31 16:00 为北京时间次年 1 月 1 日', () => {
    expect(toZonedParts('2026-12-31T16:00:00.000Z', OFFSET)).toMatchObject({ year: 2027, month: 1, day: 1 })
  })

  it('字段与绝对时刻互为逆运算', () => {
    const parts = toZonedParts(INSTANT, OFFSET)
    expect(new Date(fromZonedParts(parts, OFFSET)).toISOString()).toBe(INSTANT)
  })

  it('接受 Date 与毫秒时间戳', () => {
    expect(toZonedParts(new Date(INSTANT), OFFSET).hour).toBe(20)
    expect(toZonedParts(Date.parse(INSTANT), OFFSET).hour).toBe(20)
  })

  it('非法时间抛出可读错误', () => {
    expect(() => toZonedParts('not-a-time', OFFSET)).toThrow('时间无效')
  })
})

describe('展示格式化', () => {
  it('绝对时刻 → 北京时间文本，不再是 UTC 墙钟', () => {
    expect(formatZonedDateTime(INSTANT)).toBe('2026-09-11 20:34')
  })

  it('带时区标注的完整文本', () => {
    expect(formatZonedTimestamp(INSTANT)).toBe('2026-09-11 20:34（北京时间 UTC+8）')
    expect(formatZoneLabel()).toBe('北京时间 UTC+8')
  })

  it('偏移量文本支持整点与半点', () => {
    expect(formatUtcOffset(480)).toBe('UTC+8')
    expect(formatUtcOffset(0)).toBe('UTC+0')
    expect(formatUtcOffset(-210)).toBe('UTC-3:30')
  })

  it('非法输入返回占位符而不是抛错', () => {
    expect(formatZonedDateTime('rubbish')).toBe('—')
  })
})

describe('datetime-local 输入换算', () => {
  it('输入按排盘时区解释，而不是设备本地时区', () => {
    expect(parseZonedInput('2026-09-11T20:34', OFFSET)).toBe(INSTANT)
  })

  it('回填按排盘时区输出', () => {
    expect(toZonedInputValue(INSTANT, OFFSET)).toBe('2026-09-11T20:34')
  })

  it('往返一致', () => {
    expect(toZonedInputValue(parseZonedInput('2026-09-11T20:34', OFFSET)!, OFFSET)).toBe('2026-09-11T20:34')
  })

  it('拒绝不存在的日期与非法格式', () => {
    expect(parseZonedInput('2026-02-30T08:00', OFFSET)).toBeNull()
    expect(parseZonedInput('2026-13-01T08:00', OFFSET)).toBeNull()
    expect(parseZonedInput('2026-09-11', OFFSET)).toBeNull()
    expect(parseZonedInput('', OFFSET)).toBeNull()
  })

  it('非法绝对时刻回填空字符串', () => {
    expect(toZonedInputValue('nope', OFFSET)).toBe('')
  })
})
