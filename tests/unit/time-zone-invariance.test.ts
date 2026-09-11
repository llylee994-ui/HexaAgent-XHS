import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calculateSizhu } from '../../src/engines/calendar/calendar'
import { buildChart } from '../../src/engines/najia/chart'
import { CAST_TIME_ZONE } from '../../src/domain/time-zone'
import { beijing, beijingIso } from '../fixtures/beijing-time'

/**
 * 同一绝对时刻必须在任意宿主时区得到同一四柱。
 * 这些断言只用绝对时刻，因此在 TZ=UTC / TZ=America/New_York / 默认时区下结果相同
 * （三时区矩阵由 npm test 的三个 TZ 环境重复执行）。
 */
describe('排盘与宿主时区无关', () => {
  it('2026-09-11T12:34:00.000Z（北京时间 20:34）→ 丙午 丁酉 戊子 壬戌', () => {
    expect(calculateSizhu('2026-09-11T12:34:00.000Z')).toEqual({
      year: '丙午',
      month: '丁酉',
      day: '戊子',
      hour: '壬戌',
    })
  })

  it('跨日边界按排盘时区：UTC 16:30 属北京时间次日，日柱随之改变', () => {
    const beforeMidnight = calculateSizhu('2026-09-11T15:30:00.000Z') // 北京时间 23:30
    const afterMidnight = calculateSizhu('2026-09-11T16:30:00.000Z') // 北京时间次日 00:30
    expect(beforeMidnight.day).toBe('戊子')
    expect(afterMidnight.day).toBe('己丑')
    expect(afterMidnight.hour).toBe('甲子')
    expect(afterMidnight.month).toBe(beforeMidnight.month)
    expect(afterMidnight.year).toBe(beforeMidnight.year)
  })

  it('显式传递其他时区偏移时，日历字段按该时区解释（参数化而非硬编码）', () => {
    const instant = '2026-09-11T16:30:00.000Z'
    expect(calculateSizhu(instant).day).toBe('己丑') // 北京时间 09-12
    expect(calculateSizhu(instant, 0).day).toBe('戊子') // UTC 09-11
  })

  it('同一爻值 + 同一时刻 → 同一卦象（三个入口收敛到同一 buildChart）', () => {
    const rawValues = [6, 7, 7, 7, 7, 7] as const
    const first = buildChart(rawValues, beijingIso('2026-08-28 12:00'))
    const second = buildChart(rawValues, beijing('2026-08-28 12:00'))
    expect(second).toEqual(first)
    expect(first.sizhu).toEqual({ year: '丙午', month: '丙申', day: '甲戌', hour: '庚午' })
  })

  it('显式时区参数与默认时区一致', () => {
    const instant = beijingIso('2026-08-28 12:00')
    expect(calculateSizhu(instant, CAST_TIME_ZONE.offsetMinutes)).toEqual(calculateSizhu(instant))
  })
})

describe('引擎层不得读取宿主时区字段', () => {
  it('src/engines 下不存在 getFullYear/getHours/getTimezoneOffset 等调用', () => {
    const forbidden = ['getFullYear', 'getMonth', 'getDate', 'getHours', 'getMinutes', 'getSeconds', 'getDay(', 'getTimezoneOffset']
    const offenders: string[] = []

    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) {
          walk(path)
          continue
        }
        if (!entry.name.endsWith('.ts')) continue
        const text = readFileSync(path, 'utf8')
        for (const pattern of forbidden) {
          if (text.includes(pattern)) {
            offenders.push(`${entry.name}: ${pattern}`)
          }
        }
      }
    }

    walk(join(process.cwd(), 'src', 'engines'))
    expect(offenders).toEqual([])
  })
})
