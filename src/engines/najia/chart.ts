import type {
  CastTimeZone,
  HexagramChart,
  HexagramFigure,
  Fushen,
  LinePosition,
  OverrideField,
  RawYaoValue,
  Sizhu,
  YaoLine,
} from '../../domain/types'
import { CAST_TIME_ZONE } from '../../domain/time-zone'
import { buildHexagram, type BasicHexagramFigure } from '../hexagram/engine'
import { calculateSizhu, sizhuXunKong } from '../calendar/calendar'
import { getZhiWuxing } from '../calendar/ganzhi'
import { getHexagramNazhi } from './nazhi'
import { getLiuqin } from './liuqin'
import { getLiushenByDayGan } from './liushen'
import { shiyingPositions } from './shiying'
import { attachFushen } from './fushen'

export interface ChartLineOverrides {
  gan?: string
  zhi?: string
  liuqin?: string
  liushen?: string
  shiYing?: 'shi' | 'ying' | null
  xunKong?: boolean
  fushen?: Fushen | null
}

export interface ChartOverrides {
  sizhu?: Sizhu
  lines?: Partial<Record<LinePosition, ChartLineOverrides>>
}

interface DecorateContext {
  dayGan: string
  xunKong: readonly string[]
  /** 六亲计算基准：本卦与变卦都使用本卦卦宫五行 */
  liuqinBase: string
}

/** 为基础六爻补全纳甲、五行、六亲、六神、世应与旬空 */
function decorateLines(figure: BasicHexagramFigure, context: DecorateContext): YaoLine[] {
  const nazhi = getHexagramNazhi(figure.upperTrigram, figure.lowerTrigram)
  const liushen = getLiushenByDayGan(context.dayGan)
  const shiYing = shiyingPositions(figure.shiPosition)
  const xunKong = new Set(context.xunKong)

  return figure.lines.map((line, index) => ({
    position: line.position,
    rawValue: line.rawValue,
    type: line.type,
    changing: line.changing,
    gan: nazhi[index][0],
    zhi: nazhi[index][1],
    wuxing: getZhiWuxing(nazhi[index][1]),
    liuqin: getLiuqin(context.liuqinBase, nazhi[index][1]),
    liushen: liushen[index],
    shiYing: shiYing[line.position],
    xunKong: xunKong.has(nazhi[index][1]),
    fushen: null,
    overriddenFields: [],
  }))
}

function applyLineOverrides(
  lines: readonly YaoLine[],
  overrides: Partial<Record<LinePosition, ChartLineOverrides>> | undefined,
  context: DecorateContext,
  allowFushen = false,
): YaoLine[] {
  if (!overrides) {
    return [...lines]
  }
  const xunKongSet = new Set(context.xunKong)

  return lines.map((line) => {
    const override = overrides[line.position]
    if (!override) {
      return line
    }
    const overridden = new Set<OverrideField>(line.overriddenFields ?? [])
    const merged: YaoLine = { ...line }

    if (override.gan !== undefined) {
      merged.gan = override.gan
      overridden.add('gan')
    }
    if (override.zhi !== undefined) {
      merged.zhi = override.zhi
      merged.wuxing = getZhiWuxing(override.zhi)
      overridden.add('zhi')
    }
    if (override.liuqin !== undefined) {
      merged.liuqin = override.liuqin
      overridden.add('liuqin')
    } else if (override.zhi !== undefined) {
      merged.liuqin = getLiuqin(context.liuqinBase, override.zhi)
    }
    if (override.liushen !== undefined) {
      merged.liushen = override.liushen
      overridden.add('liushen')
    }
    if (override.shiYing !== undefined) {
      merged.shiYing = override.shiYing
      overridden.add('shiYing')
    }
    if (override.xunKong !== undefined) {
      merged.xunKong = override.xunKong
      overridden.add('xunKong')
    } else if (override.zhi !== undefined) {
      merged.xunKong = xunKongSet.has(override.zhi)
    }
    if (allowFushen && override.fushen !== undefined) {
      merged.fushen = override.fushen
      overridden.add('fushen')
    }

    merged.overriddenFields = [...overridden]
    return merged
  })
}

function toFigure(figure: BasicHexagramFigure, lines: readonly YaoLine[]): HexagramFigure {
  return {
    name: figure.name,
    upperTrigram: figure.upperTrigram,
    lowerTrigram: figure.lowerTrigram,
    palace: figure.palace,
    palaceElement: figure.palaceElement,
    lines: [...lines],
  }
}

export interface BuildChartOptions {
  /** 排盘时区，缺省为北京时间（UTC+8） */
  timeZone?: CastTimeZone
}

/**
 * 四柱是否被人工覆盖：与按起卦时间自动推导的结果不同即为覆盖。
 * 迁移自 v1 的记录未保存时区（timeZone.assumed），其快照无法与之比对，一律视为未覆盖。
 */
export function isSizhuOverridden(
  castAt: string,
  chart: HexagramChart | null,
  timeZone?: CastTimeZone,
): boolean {
  if (!chart || timeZone?.assumed) return false
  try {
    const computed = calculateSizhu(castAt, (timeZone ?? CAST_TIME_ZONE).offsetMinutes)
    return (
      computed.year !== chart.sizhu.year ||
      computed.month !== chart.sizhu.month ||
      computed.day !== chart.sizhu.day ||
      computed.hour !== chart.sizhu.hour
    )
  } catch {
    return false
  }
}

/**
 * 唯一的正式排盘入口：爻值 + 起卦时间（可选专业覆盖）→ 完整卦象。
 * 起卦时间与四柱都按 options.timeZone 解释；覆盖字段在最后合并；
 * 覆盖地支时五行、六亲与旬空随之重算。
 */
export function buildChart(
  rawValues: readonly RawYaoValue[],
  castAt: string | number | Date,
  overrides?: ChartOverrides,
  options?: BuildChartOptions,
): HexagramChart {
  const basic = buildHexagram(rawValues)
  const timeZone = options?.timeZone ?? CAST_TIME_ZONE

  const sizhu = overrides?.sizhu ?? calculateSizhu(castAt, timeZone.offsetMinutes)
  const xunKong = sizhuXunKong(sizhu)
  const context: DecorateContext = {
    dayGan: sizhu.day[0],
    xunKong,
    liuqinBase: basic.original.palaceElement,
  }

  const originalLines = attachFushen(
    decorateLines(basic.original, context),
    basic.original.palace,
    basic.original.palaceElement,
  )

  const original = toFigure(
    basic.original,
    applyLineOverrides(originalLines, overrides?.lines, context, true),
  )

  const changed = basic.changed
    ? toFigure(basic.changed, applyLineOverrides(decorateLines(basic.changed, context), overrides?.lines, context))
    : null

  return {
    original,
    changed,
    changingLines: [...basic.changingLines],
    allChanging: basic.allChanging,
    sizhu,
    xunKong,
  }
}
