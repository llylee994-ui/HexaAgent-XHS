import { JIE_OFFSET_MINUTES, SOLAR_TERM_FROM_YEAR, SOLAR_TERM_TO_YEAR } from './solar-terms-data'
import { CAST_TIME_ZONE, toZonedParts } from './zoned-time'

/**
 * 十二"节"，按公历年内出现顺序排列：索引 0 = 小寒（丑月的界），索引 1 = 立春（年柱的界）。
 * 交节时刻取自 solar-terms-data.ts（UTC+8，与香港天文台公布值逐项核对过）。
 */
export const JIE_NAMES = [
  '小寒', '立春', '惊蛰', '清明', '立夏', '芒种',
  '小暑', '立秋', '白露', '寒露', '立冬', '大雪',
] as const

/** 立春在 JIE_NAMES 中的下标：干支年的分界 */
export const LI_CHUN_JIE_INDEX = 1

/** 支持排盘的年份区间（UTC+8 公历年）；区间外一律报错，不做近似降级 */
export const SUPPORTED_YEAR_RANGE = { fromYear: 1900, toYear: 2100 } as const

export class SolarTermRangeError extends Error {
  constructor(year: number) {
    super(`起卦时间超出支持范围（${SUPPORTED_YEAR_RANGE.fromYear}–${SUPPORTED_YEAR_RANGE.toYear} 年）`)
    this.name = 'SolarTermRangeError'
    void year
  }
}

/** 某公历年第 index 个"节"的交节时刻（绝对时刻 ms） */
export function jieInstant(year: number, index: number): number {
  const row = JIE_OFFSET_MINUTES[year - SOLAR_TERM_FROM_YEAR]
  if (!row || index < 0 || index >= row.length) {
    throw new SolarTermRangeError(year)
  }
  return Date.UTC(year, 0, 1) + row[index] * 60_000 - CAST_TIME_ZONE.offsetMinutes * 60_000
}

export interface JieMatch {
  /** 该"节"所属公历年 */
  year: number
  /** 在 JIE_NAMES 中的下标 */
  index: number
  /** 交节绝对时刻（ms） */
  instant: number
  /** 月支索引：寅月 = 0 … 丑月 = 11 */
  monthBranchIndex: number
  /** 节气年（立春为界）：月干与年柱都按它推导 */
  springYear: number
}

/**
 * 绝对时刻所属的"节"。
 * 边界规则：交节时刻当刻即属新月（>= 交节时刻）。
 * 1900 年 1 月小寒之前的时刻会回退到 1899 年的大雪（子月），因此数据表多收录了 1899 年。
 */
export function jieAt(
  instant: Date | number | string,
  offsetMinutes: number = CAST_TIME_ZONE.offsetMinutes,
): JieMatch {
  const millis = typeof instant === 'number' ? instant : typeof instant === 'string' ? Date.parse(instant) : instant.valueOf()
  if (Number.isNaN(millis)) {
    throw new Error('时间无效')
  }
  const { year: calendarYear } = toZonedParts(millis, offsetMinutes)
  if (calendarYear < SUPPORTED_YEAR_RANGE.fromYear || calendarYear > SUPPORTED_YEAR_RANGE.toYear) {
    throw new SolarTermRangeError(calendarYear)
  }

  let year = calendarYear
  let index = -1
  for (let candidate = JIE_NAMES.length - 1; candidate >= 0; candidate -= 1) {
    if (millis >= jieInstant(year, candidate)) {
      index = candidate
      break
    }
  }
  if (index < 0) {
    // 早于本年的小寒：仍属上一年的子月（大雪）
    year -= 1
    index = JIE_NAMES.length - 1
  }

  return {
    year,
    index,
    instant: jieInstant(year, index),
    monthBranchIndex: (index + 11) % 12,
    springYear: index >= LI_CHUN_JIE_INDEX ? year : year - 1,
  }
}

/** 判断绝对时刻是否落在支持范围内（不抛错版本，供界面预校验） */
export function isWithinSupportedRange(
  instant: Date | number | string,
  offsetMinutes: number = CAST_TIME_ZONE.offsetMinutes,
): boolean {
  try {
    jieAt(instant, offsetMinutes)
    return true
  } catch {
    return false
  }
}

export { SOLAR_TERM_FROM_YEAR, SOLAR_TERM_TO_YEAR }
