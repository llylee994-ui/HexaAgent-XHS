import { describe, expect, it } from 'vitest'
import { calculateSizhu, dayGanzhi, hourGanzhi, monthGanzhi, yearGanzhi } from '../../src/engines/calendar/calendar'
import { getXunKong } from '../../src/engines/calendar/ganzhi'
import { beijing } from '../fixtures/beijing-time'

/**
 * 所有断言都基于显式绝对时刻（北京时间的墙上时刻）。
 * 节气使用香港天文台公布的交节时刻（UTC+8，分钟级），例如 2026 年立秋 8/7 19:43、白露 9/7 22:41。
 */
describe('calculateSizhu（固定时刻）', () => {
  it('2026-08-28 12:00 → 丙午年 丙申月 甲戌日 庚午时', () => {
    const sizhu = calculateSizhu(beijing('2026-08-28 12:00'))
    expect(sizhu).toEqual({ year: '丙午', month: '丙申', day: '甲戌', hour: '庚午' })
  })

  it('立春前年柱归上一年：2026-02-03 → 乙巳年 己丑月', () => {
    const sizhu = calculateSizhu(beijing('2026-02-03 12:00'))
    expect(sizhu.year).toBe('乙巳')
    expect(sizhu.month).toBe('己丑')
  })

  it('立春当日以交节时刻为界：2026-02-04 04:01 仍属乙巳年己丑月，04:03 起为丙午年庚寅月', () => {
    expect(calculateSizhu(beijing('2026-02-04 04:01'))).toMatchObject({ year: '乙巳', month: '己丑' })
    expect(calculateSizhu(beijing('2026-02-04 04:03'))).toMatchObject({ year: '丙午', month: '庚寅' })
  })

  it('节气月边界按交节时刻：2026 立秋 8/7 19:43，19:42 仍属未月，19:44 起属申月', () => {
    expect(monthGanzhi(beijing('2026-08-07 19:42'))).toBe('乙未')
    expect(monthGanzhi(beijing('2026-08-07 19:44'))).toBe('丙申')
  })

  it('1900-01-01 基准日为甲戌日，整柱为己亥 丙子 甲戌 甲子', () => {
    const sizhu = calculateSizhu(beijing('1900-01-01 00:00'))
    expect(sizhu).toEqual({ year: '己亥', month: '丙子', day: '甲戌', hour: '甲子' })
  })

  it('23 点按当日子时计（晚子时不换日）：甲戌日子时为甲子时', () => {
    const sizhu = calculateSizhu(beijing('2026-08-28 23:00'))
    expect(sizhu.day).toBe('甲戌')
    expect(sizhu.hour).toBe('甲子')
  })
})

/**
 * 回归：旧实现使用固定公历日期表，2026 年有 5 个"节"整整差一天，
 * 下列时刻在旧实现下会判错月份。
 */
describe('固定日期表的历史误差已修正', () => {
  it('小寒 1/5 16:23：1/5 17:00 属丑月（旧实现 1/5 仍算子月）', () => {
    expect(monthGanzhi(beijing('2026-01-05 17:00'))).toBe('己丑')
    expect(monthGanzhi(beijing('2026-01-05 16:22'))).toBe('戊子')
  })

  it('惊蛰 3/5 21:59：3/5 22:00 属卯月（旧实现 3/5 仍算寅月）', () => {
    expect(monthGanzhi(beijing('2026-03-05 22:00'))).toBe('辛卯')
    expect(monthGanzhi(beijing('2026-03-05 21:58'))).toBe('庚寅')
  })

  it('立夏 5/5 19:49：5/5 20:00 属巳月（旧实现 5/5 仍算辰月）', () => {
    expect(monthGanzhi(beijing('2026-05-05 20:00'))).toBe('癸巳')
  })

  it('芒种 6/5 23:48：6/5 23:50 属午月（旧实现 6/5 仍算巳月）', () => {
    expect(monthGanzhi(beijing('2026-06-05 23:50'))).toBe('甲午')
  })

  it('白露 9/7 22:41：9/7 23:00 属酉月（旧实现 9/7 仍算申月）', () => {
    expect(monthGanzhi(beijing('2026-09-07 23:00'))).toBe('丁酉')
    expect(monthGanzhi(beijing('2026-09-07 22:40'))).toBe('丙申')
  })
})

describe('支持范围', () => {
  it('超出 1900–2100 的起卦时间明确报错，不静默降级', () => {
    expect(() => calculateSizhu('1898-12-31T16:00:00.000Z')).toThrow(/支持范围/)
    expect(() => calculateSizhu('2101-06-01T04:00:00.000Z')).toThrow(/支持范围/)
  })

  it('区间两端可用：1900-01-06 与 2100-12-07 都能排盘', () => {
    expect(yearGanzhi(beijing('1900-01-06 12:00'))).toBe('己亥')
    expect(() => calculateSizhu(beijing('2100-12-07 12:00'))).not.toThrow()
    expect(dayGanzhi(beijing('2100-12-07 12:00')).length).toBe(2)
    expect(hourGanzhi(beijing('2100-12-07 12:00')).length).toBe(2)
  })
})

describe('getXunKong（六个旬首）', () => {
  it('甲子旬空戌亥，甲戌旬空申酉，甲申旬空午未', () => {
    expect(getXunKong('甲子')).toEqual(['戌', '亥'])
    expect(getXunKong('甲戌')).toEqual(['申', '酉'])
    expect(getXunKong('甲申')).toEqual(['午', '未'])
  })

  it('甲午旬空辰巳，甲辰旬空寅卯，甲寅旬空子丑', () => {
    expect(getXunKong('甲午')).toEqual(['辰', '巳'])
    expect(getXunKong('甲辰')).toEqual(['寅', '卯'])
    expect(getXunKong('甲寅')).toEqual(['子', '丑'])
  })

  it('非甲日：癸卯日在甲午旬，旬空辰巳', () => {
    expect(getXunKong('癸卯')).toEqual(['辰', '巳'])
  })
})
