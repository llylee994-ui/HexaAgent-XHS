import { describe, expect, it } from 'vitest'
import { buildChart } from '../../src/engines/najia/chart'
import { beijing } from '../fixtures/beijing-time'

// 固定起卦时间：2026-08-28 12:00 → 丙午年 丙申月 甲戌日 庚午时，旬空申酉
const CAST_AT = beijing('2026-08-28 12:00')

describe('buildChart 完整排盘（天风姤初爻动）', () => {
  const chart = buildChart([6, 7, 7, 7, 7, 7], CAST_AT)

  it('四柱与旬空来自起卦时间', () => {
    expect(chart.sizhu).toEqual({ year: '丙午', month: '丙申', day: '甲戌', hour: '庚午' })
    expect(chart.xunKong).toEqual(['申', '酉'])
  })

  it('每条本卦爻均有干、支、五行、六亲、六神、世应与旬空标记', () => {
    for (const line of chart.original.lines) {
      expect(line.gan, `第${line.position}爻天干`).not.toBe('')
      expect(line.zhi, `第${line.position}爻地支`).not.toBe('')
      expect(line.wuxing, `第${line.position}爻五行`).not.toBe('')
      expect(line.liuqin, `第${line.position}爻六亲`).not.toBe('')
      expect(line.liushen, `第${line.position}爻六神`).not.toBe('')
    }
  })

  it('初爻为辛丑父母、临世、起青龙', () => {
    const line1 = chart.original.lines[0]
    expect(line1.gan).toBe('辛')
    expect(line1.zhi).toBe('丑')
    expect(line1.wuxing).toBe('土')
    expect(line1.liuqin).toBe('父母')
    expect(line1.liushen).toBe('青龙')
    expect(line1.shiYing).toBe('shi')
    expect(line1.xunKong).toBe(false)
  })

  it('第三爻辛酉金兄弟旬空，第五爻壬申金兄弟旬空', () => {
    expect(chart.original.lines[2].zhi).toBe('酉')
    expect(chart.original.lines[2].xunKong).toBe(true)
    expect(chart.original.lines[4].zhi).toBe('申')
    expect(chart.original.lines[4].xunKong).toBe(true)
  })

  it('第四爻壬午火官鬼临应，六神腾蛇', () => {
    const line4 = chart.original.lines[3]
    expect(line4.liuqin).toBe('官鬼')
    expect(line4.liushen).toBe('腾蛇')
    expect(line4.shiYing).toBe('ying')
  })

  it('妻财未现，伏于二爻寅木之下', () => {
    const fushenByLine = chart.original.lines.map((line) => line.fushen)
    expect(fushenByLine).toEqual([
      null,
      { liuqin: '妻财', zhi: '寅' },
      null,
      null,
      null,
      null,
    ])
  })

  it('变卦乾为天纳甲完整且六爻不再带动爻', () => {
    const changed = chart.changed!
    expect(changed.name).toBe('乾为天')
    expect(changed.lines.map((l) => `${l.gan}${l.zhi}`)).toEqual([
      '甲子', '甲寅', '甲辰', '壬午', '壬申', '壬戌',
    ])
    for (const line of changed.lines) {
      expect(line.changing).toBe(false)
    }
  })

  it('变卦六亲以本卦乾宫金为基准', () => {
    const changed = chart.changed!
    expect(changed.lines.map((l) => l.liuqin)).toEqual([
      '子孙', '妻财', '父母', '官鬼', '兄弟', '父母',
    ])
  })

  it('变卦世应按变卦自身世位（乾为天世在上爻）', () => {
    const changed = chart.changed!
    expect(changed.lines[5].shiYing).toBe('shi')
    expect(changed.lines[2].shiYing).toBe('ying')
  })
})

describe('buildChart 变卦六亲回归（坤为地六爻皆动）', () => {
  it('变卦乾为天六亲使用本卦坤宫土，而非变卦乾宫金', () => {
    const chart = buildChart([6, 6, 6, 6, 6, 6], CAST_AT)
    expect(chart.changed!.name).toBe('乾为天')
    // 坤宫土：子水土克为妻财，寅木木克为官鬼，午火火生为父母
    expect(chart.changed!.lines.map((l) => l.liuqin)).toEqual([
      '妻财', '官鬼', '兄弟', '父母', '子孙', '兄弟',
    ])
  })
})

describe('buildChart 伏神固定案例（地雷复静卦，父母伏藏）', () => {
  it('父母未现，伏于二爻巳火之下', () => {
    const chart = buildChart([7, 8, 8, 8, 8, 8], CAST_AT)
    expect(chart.original.name).toBe('地雷复')
    expect(chart.original.lines.map((l) => l.liuqin)).toEqual([
      '妻财', '官鬼', '兄弟', '兄弟', '妻财', '子孙',
    ])
    expect(chart.original.lines[1].fushen).toEqual({ liuqin: '父母', zhi: '巳' })
  })
})

describe('buildChart 静卦与专业覆盖', () => {
  it('静卦没有变卦', () => {
    const chart = buildChart([7, 7, 7, 7, 7, 7], CAST_AT)
    expect(chart.changed).toBeNull()
    expect(chart.changingLines).toEqual([])
    expect(chart.allChanging).toBe(false)
  })

  it('六爻皆动时标记 allChanging', () => {
    const chart = buildChart([9, 9, 9, 9, 9, 9], CAST_AT)
    expect(chart.allChanging).toBe(true)
  })

  it('专业覆盖字段在最后合并', () => {
    const chart = buildChart([6, 7, 7, 7, 7, 7], CAST_AT, {
      lines: { 1: { liushen: '玄武', zhi: '午' } },
    })
    expect(chart.original.lines[0].liushen).toBe('玄武')
    expect(chart.original.lines[0].zhi).toBe('午')
    expect(chart.original.lines[1].liushen).toBe('朱雀')
  })

  it('覆盖四柱后旬空按新日柱重算', () => {
    const chart = buildChart([6, 7, 7, 7, 7, 7], CAST_AT, {
      sizhu: { year: '丙午', month: '丙申', day: '甲子', hour: '庚午' },
    })
    expect(chart.sizhu.day).toBe('甲子')
    expect(chart.xunKong).toEqual(['戌', '亥'])
  })
})
