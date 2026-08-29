import type { Sizhu } from '../../domain/types'
import { DI_ZHI, JIAZI_TABLE, TIAN_GAN, getXunKong, shiGan, yueGan } from './ganzhi'

// 节气日近似表：每月两个节气中的"节"（月始），用于月柱划分。
// 首版兼容实现：固定公历日期，与真实节气可能相差 ±1 日。
const JIE_QI: readonly (readonly [number, number])[] = [
  [2, 4], // 立春 → 寅月
  [3, 6], // 惊蛰 → 卯月
  [4, 5], // 清明 → 辰月
  [5, 6], // 立夏 → 巳月
  [6, 6], // 芒种 → 午月
  [7, 7], // 小暑 → 未月
  [8, 7], // 立秋 → 申月
  [9, 8], // 白露 → 酉月
  [10, 8], // 寒露 → 戌月
  [11, 7], // 立冬 → 亥月
  [12, 7], // 大雪 → 子月
  [1, 6], // 小寒 → 丑月
]

// 基准日：1900-01-01 = 甲戌日（六十甲子索引 10）
const DAY_PILLAR_BASE_UTC_DAYS = Date.UTC(1900, 0, 1) / 86_400_000
const DAY_PILLAR_BASE_INDEX = 10

function utcDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
}

/** 公历日期 → 年柱干支（以立春为界） */
export function yearGanzhi(date: Date): string {
  let year = date.getFullYear()
  if (date.getMonth() + 1 === 1 || (date.getMonth() + 1 === 2 && date.getDate() < 4)) {
    year -= 1
  }
  return `${TIAN_GAN[(year - 4) % 10]}${DI_ZHI[(year - 4) % 12]}`
}

/** 公历日期 → 月柱干支（以节气为界，月干由节气年年干五虎遁而得） */
export function monthGanzhi(date: Date): string {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const springYear = month > 2 || (month === 2 && day >= 4) ? date.getFullYear() : date.getFullYear() - 1

  // 节气月索引：Feb..Dec 用 springYear，小寒（1 月）用 springYear + 1
  let monthIdx = 0
  for (let i = 0; i < JIE_QI.length; i++) {
    const [m, d] = JIE_QI[i]
    const jieDate = new Date(springYear + (m === 1 ? 1 : 0), m - 1, d)
    if (utcDayNumber(date) >= utcDayNumber(jieDate)) {
      monthIdx = i
    } else {
      break
    }
  }

  const springYearGan = yearGanzhi(new Date(springYear, 5, 1))[0]
  return `${yueGan(springYearGan, monthIdx)}${DI_ZHI[(monthIdx + 2) % 12]}`
}

/** 公历日期 → 日柱干支（60 日循环） */
export function dayGanzhi(date: Date): string {
  const days = utcDayNumber(date) - DAY_PILLAR_BASE_UTC_DAYS
  return JIAZI_TABLE[(DAY_PILLAR_BASE_INDEX + days) % 60]
}

/** 公历时刻 → 时柱干支（23-1 点为子时，首版按当日日干起时，不换日） */
export function hourGanzhi(date: Date): string {
  const hour = date.getHours()
  const hourZhiIdx = (((hour + 1) >> 1) % 12 + 12) % 12
  const dayGan = dayGanzhi(date)[0]
  return `${shiGan(dayGan, hourZhiIdx)}${DI_ZHI[hourZhiIdx]}`
}

/** 公历时刻 → 四柱 */
export function calculateSizhu(date: Date): Sizhu {
  return {
    year: yearGanzhi(date),
    month: monthGanzhi(date),
    day: dayGanzhi(date),
    hour: hourGanzhi(date),
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
