import type { Sizhu, ZonedParts } from '../../domain/types'
import { DI_ZHI, JIAZI_TABLE, TIAN_GAN, getXunKong, shiGan, yueGan } from './ganzhi'
import { jieAt } from './solar-terms'
import { CAST_TIME_ZONE, toZonedParts } from './zoned-time'

/**
 * 四柱推算。所有函数都以「绝对时刻 + 排盘时区」为输入，内部只读该时区的日历字段，
 * 不读宿主本地字段，因此同一绝对时刻在任意设备时区下结果相同。
 *
 * 年柱以立春交节时刻为界，月柱以十二"节"交节时刻为界（时刻比较，非日期比较）。
 * 时柱按 23:00 起子时、且 23:00-23:59 不换日柱（晚子时不换日）的规则。
 */

// 基准日：1900-01-01 = 甲戌日（六十甲子索引 10）
const DAY_PILLAR_BASE_UTC_DAYS = Date.UTC(1900, 0, 1) / 86_400_000
const DAY_PILLAR_BASE_INDEX = 10

function zonedDayNumber(parts: ZonedParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000
}

function yearPillarOf(calendarYear: number): string {
  return `${TIAN_GAN[(calendarYear - 4) % 10]}${DI_ZHI[(calendarYear - 4) % 12]}`
}

/** 绝对时刻 → 年柱干支（以立春交节时刻为界） */
export function yearGanzhi(
  instant: Date | number | string,
  offsetMinutes: number = CAST_TIME_ZONE.offsetMinutes,
): string {
  return yearPillarOf(jieAt(instant, offsetMinutes).springYear)
}

/** 绝对时刻 → 月柱干支（以"节"交节时刻为界，月干由节气年年干五虎遁而得） */
export function monthGanzhi(
  instant: Date | number | string,
  offsetMinutes: number = CAST_TIME_ZONE.offsetMinutes,
): string {
  const { springYear, monthBranchIndex } = jieAt(instant, offsetMinutes)
  const springYearGan = TIAN_GAN[(springYear - 4) % 10]
  return `${yueGan(springYearGan, monthBranchIndex)}${DI_ZHI[(monthBranchIndex + 2) % 12]}`
}

/** 绝对时刻 → 日柱干支（60 日循环，按排盘时区的日历日） */
export function dayGanzhi(
  instant: Date | number | string,
  offsetMinutes: number = CAST_TIME_ZONE.offsetMinutes,
): string {
  const days = zonedDayNumber(toZonedParts(instant, offsetMinutes)) - DAY_PILLAR_BASE_UTC_DAYS
  return JIAZI_TABLE[((DAY_PILLAR_BASE_INDEX + days) % 60 + 60) % 60]
}

/** 绝对时刻 → 时柱干支（23-1 点为子时，按当日日干起时，不换日柱） */
export function hourGanzhi(
  instant: Date | number | string,
  offsetMinutes: number = CAST_TIME_ZONE.offsetMinutes,
): string {
  const { hour } = toZonedParts(instant, offsetMinutes)
  const hourZhiIndex = (((hour + 1) >> 1) % 12 + 12) % 12
  const dayGan = dayGanzhi(instant, offsetMinutes)[0]
  return `${shiGan(dayGan, hourZhiIndex)}${DI_ZHI[hourZhiIndex]}`
}

/** 绝对时刻 → 四柱 */
export function calculateSizhu(
  instant: Date | number | string,
  offsetMinutes: number = CAST_TIME_ZONE.offsetMinutes,
): Sizhu {
  return {
    year: yearGanzhi(instant, offsetMinutes),
    month: monthGanzhi(instant, offsetMinutes),
    day: dayGanzhi(instant, offsetMinutes),
    hour: hourGanzhi(instant, offsetMinutes),
  }
}

/** 四柱 → 月建（月支）与日辰（日支） */
export function getSizhuMarkers(sizhu: Sizhu): { yueJian: string; riChen: string } {
  return { yueJian: sizhu.month[1], riChen: sizhu.day[1] }
}

/** 四柱 → 旬空（按日柱） */
export function sizhuXunKong(sizhu: Sizhu): readonly [string, string] {
  return getXunKong(sizhu.day)
}
