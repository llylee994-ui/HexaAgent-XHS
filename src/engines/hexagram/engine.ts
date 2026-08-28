import type { LinePosition, RawYaoValue, YinYang } from '../../domain/types'
import { findTrigramByLines } from './trigrams'
import { getHexagramEntry } from './table'

export interface HexagramIdentity {
  name: string
  upperTrigram: string
  lowerTrigram: string
  palace: string
  palaceElement: string
  shiPosition: LinePosition
}

export interface BasicYaoLine {
  position: LinePosition
  rawValue: RawYaoValue
  type: YinYang
  changing: boolean
}

export interface BasicHexagramFigure extends HexagramIdentity {
  lines: readonly BasicYaoLine[]
}

export interface BasicHexagramChart {
  original: BasicHexagramFigure
  changed: BasicHexagramFigure | null
  changingLines: readonly LinePosition[]
  allChanging: boolean
}

export function identifyHexagram(lines: readonly YinYang[]): HexagramIdentity {
  if (lines.length !== 6) {
    throw new Error(`爻数必须为六，收到 ${lines.length}`)
  }
  const lowerTrigram = findTrigramByLines(lines.slice(0, 3))
  const upperTrigram = findTrigramByLines(lines.slice(3, 6))
  return getHexagramEntry(upperTrigram, lowerTrigram)
}

function toChangedBasicLines(types: readonly YinYang[]): BasicYaoLine[] {
  // 变卦爻不再带动爻，按阴阳补记少阳/少阴值
  return types.map((type, index) => ({
    position: (index + 1) as LinePosition,
    rawValue: type === 'yang' ? 7 : 8,
    type,
    changing: false,
  }))
}

function flipChanging(types: readonly YinYang[], changingLines: readonly LinePosition[]): YinYang[] {
  const changingSet = new Set(changingLines)
  return types.map((type, index) =>
    changingSet.has((index + 1) as LinePosition) ? (type === 'yang' ? 'yin' : 'yang') : type,
  )
}

export function buildHexagram(rawValues: readonly RawYaoValue[]): BasicHexagramChart {
  if (rawValues.length !== 6) {
    throw new Error(`爻值必须为六个，收到 ${rawValues.length}`)
  }
  for (const value of rawValues) {
    if (value < 6 || value > 9) {
      throw new Error(`爻值必须在 6..9 之间，收到 ${value}`)
    }
  }

  const lines: BasicYaoLine[] = rawValues.map((rawValue, index) => {
    const position = (index + 1) as LinePosition
    const type: YinYang = rawValue === 7 || rawValue === 9 ? 'yang' : 'yin'
    const changing = rawValue === 6 || rawValue === 9
    return { position, rawValue, type, changing }
  })

  const types = lines.map((line) => line.type)
  const original: BasicHexagramFigure = { ...identifyHexagram(types), lines }

  const changingLines = lines
    .filter((line) => line.changing)
    .map((line) => line.position)

  if (changingLines.length === 0) {
    return { original, changed: null, changingLines: [], allChanging: false }
  }

  const changedTypes = flipChanging(types, changingLines)
  const changed: BasicHexagramFigure = {
    ...identifyHexagram(changedTypes),
    lines: toChangedBasicLines(changedTypes),
  }

  return {
    original,
    changed,
    changingLines,
    allChanging: changingLines.length === 6,
  }
}
