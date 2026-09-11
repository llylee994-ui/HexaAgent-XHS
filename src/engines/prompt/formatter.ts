import type { CoinThrow, CastMethod, CastTimeZone, HexagramFigure, LinePosition, Sizhu, YaoLine, QuestionCategory } from '../../domain/types'
import { CAST_TIME_ZONE } from '../../domain/time-zone'
import { facesToRawValue } from '../divination/coins'
import { formatUtcOffset, formatZonedDateTime, formatZoneLabel } from '../calendar/zoned-time'
import { CATEGORY_LABEL, METHOD_LABEL } from './templates'

export function formatFaces(faces: readonly (0 | 1)[]): string {
  return faces.map((face) => (face === 1 ? '正' : '反')).join('')
}

export function formatCoinThrows(throws: readonly CoinThrow[]): string[] {
  return throws.map((throwItem) => `第${throwItem.round}轮：${formatFaces(throwItem.faces)} → ${throwItem.rawValue}`)
}

export function formatMethod(method: CastMethod): string {
  return METHOD_LABEL[method]
}

export function formatCategory(category: QuestionCategory): string {
  return CATEGORY_LABEL[category] ?? category
}

export function formatSizhu(sizhu: Sizhu): string {
  return `${sizhu.year}年 ${sizhu.month}月 ${sizhu.day}日 ${sizhu.hour}时`
}

/** 起卦时间：按排盘时区输出墙上时刻并标注时区，不输出裸 UTC 时刻 */
export function formatCastTime(castAt: string, timeZone: CastTimeZone = CAST_TIME_ZONE): string {
  return `${formatZonedDateTime(castAt, timeZone.offsetMinutes)}（${formatZoneLabel(timeZone)}）`
}

/** 排盘时区标识 */
export function formatCastZone(timeZone: CastTimeZone = CAST_TIME_ZONE): string {
  return `${timeZone.id}（${formatUtcOffset(timeZone.offsetMinutes)}）`
}

/**
 * 排盘规则声明。外部 AI 复核四柱时必须知道这些约定，否则会与提示词中的四柱得出不同结论。
 */
export function formatCastRules(): string[] {
  return [
    '排盘规则：年柱以立春、月柱以十二"节"的交节时刻为界，交节时刻取香港天文台公布值（UTC+8，分钟级）',
    '排盘规则：23:00 起子时，且 23:00-23:59 不换日柱（晚子时不换日）',
    '排盘规则：未做真太阳时校正，四柱按北京时间直接计算',
  ]
}

export function formatYaoLine(line: YaoLine, changingLines: readonly LinePosition[]): string {
  const parts = [
    `第${line.position}爻`,
    line.liushen,
    `${line.gan}${line.zhi}(${line.wuxing})`,
    line.liuqin,
  ]
  if (line.shiYing === 'shi') parts.push('世')
  if (line.shiYing === 'ying') parts.push('应')
  if (line.xunKong) parts.push('旬空')
  if (changingLines.includes(line.position)) parts.push('动')
  if (line.fushen) parts.push(`伏神:${line.fushen.liuqin}${line.fushen.zhi}`)
  if (line.overriddenFields?.length) parts.push(`人工覆盖:${line.overriddenFields.join('/')}`)
  return parts.join(' ')
}

export function formatFigure(figure: HexagramFigure, changingLines: readonly LinePosition[]): string[] {
  const header = `${figure.name}（${figure.palace}宫/${figure.palaceElement}）`
  return [header, ...[...figure.lines].sort((a, b) => b.position - a.position).map((line) => `  ${formatYaoLine(line, changingLines)}`)]
}

const POSITION_LABEL: Record<LinePosition, string> = { 1: '初爻', 2: '二爻', 3: '三爻', 4: '四爻', 5: '五爻', 6: '上爻' }
const OVERRIDE_LABEL: Record<string, string> = {
  gan: '天干', zhi: '地支', liuqin: '六亲', liushen: '六神', shiYing: '世应', xunKong: '旬空', fushen: '伏神',
}

export function formatReadableYaoLine(line: YaoLine): string {
  const parts = [
    POSITION_LABEL[line.position],
    line.type === 'yang' ? '阳' : '阴',
    line.changing ? '动' : '静',
    line.liushen,
    `${line.gan}${line.zhi}（${line.wuxing}）`,
    line.liuqin,
  ]
  if (line.shiYing === 'shi') parts.push('世')
  if (line.shiYing === 'ying') parts.push('应')
  if (line.xunKong) parts.push('旬空')
  if (line.fushen) parts.push(`伏神：${line.fushen.liuqin}${line.fushen.zhi}`)
  if (line.overriddenFields?.length) {
    parts.push(`人工校正：${line.overriddenFields.map((field) => OVERRIDE_LABEL[field] ?? field).join('、')}`)
  }
  return parts.join(' · ')
}

export function formatReadableChart(caseValue: import('../../domain/types').DivinationCase): string[] {
  if (!caseValue.chart) return ['排盘尚未完成']
  const lines = [...caseValue.chart.original.lines]
    .sort((a, b) => b.position - a.position)
    .map(formatReadableYaoLine)
  const result = lines
  if (caseValue.chart.changed) {
    result.push(`变卦：${caseValue.chart.changed.name}（六亲以本卦卦宫为准）`)
    result.push(...[...caseValue.chart.changed.lines].sort((a, b) => b.position - a.position).map(formatReadableYaoLine))
  }
  return result
}

export function formatRawValue(rawValue: number): string {
  return String(rawValue)
}

export function rawValueOfFaces(faces: readonly (0 | 1)[]): number {
  return facesToRawValue([faces[0], faces[1], faces[2]])
}
