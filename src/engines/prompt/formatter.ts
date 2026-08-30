import type { CoinThrow, CastMethod, HexagramFigure, LinePosition, Sizhu, YaoLine, QuestionCategory } from '../../domain/types'
import { facesToRawValue } from '../divination/coins'
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
  return [header, ...figure.lines.map((line) => `  ${formatYaoLine(line, changingLines)}`)]
}

export function formatRawValue(rawValue: number): string {
  return String(rawValue)
}

export function rawValueOfFaces(faces: readonly (0 | 1)[]): number {
  return facesToRawValue([faces[0], faces[1], faces[2]])
}
