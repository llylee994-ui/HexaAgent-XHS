import type {
  HexagramChart,
  HexagramFigure,
  LinePosition,
  OverrideField,
  RawYaoValue,
  Sizhu,
  YaoLine,
} from '../../domain/types'
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

/**
 * 唯一的正式排盘入口：爻值 + 起卦时间（可选专业覆盖）→ 完整卦象。
 * 覆盖字段在最后合并；覆盖地支时五行、六亲与旬空随之重算。
 */
export function buildChart(
  rawValues: readonly RawYaoValue[],
  castAt: Date,
  overrides?: ChartOverrides,
): HexagramChart {
  const basic = buildHexagram(rawValues)

  const sizhu = overrides?.sizhu ?? calculateSizhu(castAt)
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
    applyLineOverrides(originalLines, overrides?.lines, context),
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
