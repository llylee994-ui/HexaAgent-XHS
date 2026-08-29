import { describe, expect, it } from 'vitest'
import { calculateSizhu } from '../../src/engines/calendar/calendar'
import { getXunKong } from '../../src/engines/calendar/ganzhi'

describe('calculateSizhu（固定日期）', () => {
  it('2026-08-28 12:00 → 丙午年 丙申月 甲戌日 庚午时', () => {
    const sizhu = calculateSizhu(new Date(2026, 7, 28, 12, 0))
    expect(sizhu).toEqual({ year: '丙午', month: '丙申', day: '甲戌', hour: '庚午' })
  })

  it('立春前年柱归上一年：2026-02-03 → 乙巳年 己丑月', () => {
    const sizhu = calculateSizhu(new Date(2026, 1, 3, 12, 0))
    expect(sizhu.year).toBe('乙巳')
    expect(sizhu.month).toBe('己丑')
  })

  it('立春当日换年换月：2026-02-04 → 丙午年 庚寅月', () => {
    const sizhu = calculateSizhu(new Date(2026, 1, 4, 12, 0))
    expect(sizhu.year).toBe('丙午')
    expect(sizhu.month).toBe('庚寅')
  })

  it('节气月边界：2026-08-06 仍属未月，2026-08-07 立秋起属申月', () => {
    expect(calculateSizhu(new Date(2026, 7, 6, 12, 0)).month).toBe('乙未')
    expect(calculateSizhu(new Date(2026, 7, 7, 12, 0)).month).toBe('丙申')
  })

  it('1900-01-01 基准日为甲戌日，整柱为己亥 丙子 甲戌 甲子', () => {
    const sizhu = calculateSizhu(new Date(1900, 0, 1, 0, 0))
    expect(sizhu).toEqual({ year: '己亥', month: '丙子', day: '甲戌', hour: '甲子' })
  })

  it('23 点按当日子时计（首版兼容，不换日）：甲戌日子时为甲子时', () => {
    const sizhu = calculateSizhu(new Date(2026, 7, 28, 23, 0))
    expect(sizhu.day).toBe('甲戌')
    expect(sizhu.hour).toBe('甲子')
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
