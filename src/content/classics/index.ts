import type { LinePosition } from '../../domain/types'
import { CLASSICS_01_08 } from './data/01-08'
import { CLASSICS_09_16 } from './data/09-16'
import { CLASSICS_17_24 } from './data/17-24'
import { CLASSICS_25_32 } from './data/25-32'
import { CLASSICS_33_40 } from './data/33-40'
import { CLASSICS_41_48 } from './data/41-48'
import { CLASSICS_49_56 } from './data/49-56'
import { CLASSICS_57_64 } from './data/57-64'
import type { HexagramClassicText } from './types'

export type {
  ClassicLine,
  ClassicPassage,
  ClassicSpecial,
  HexagramClassicText,
} from './types'

export const HEXAGRAM_CLASSICS: readonly HexagramClassicText[] = [
  ...CLASSICS_01_08,
  ...CLASSICS_09_16,
  ...CLASSICS_17_24,
  ...CLASSICS_25_32,
  ...CLASSICS_33_40,
  ...CLASSICS_41_48,
  ...CLASSICS_49_56,
  ...CLASSICS_57_64,
]

const CLASSICS_BY_NAME = new Map<string, HexagramClassicText>()
for (const item of HEXAGRAM_CLASSICS) {
  if (CLASSICS_BY_NAME.has(item.name)) {
    throw new Error(`经典文本卦名重复：${item.name}`)
  }
  CLASSICS_BY_NAME.set(item.name, item)
}

export function getHexagramClassic(name: string): HexagramClassicText | null {
  return CLASSICS_BY_NAME.get(name) ?? null
}

export function getRelevantClassicLines(
  name: string,
  positions: readonly LinePosition[],
) {
  const classic = getHexagramClassic(name)
  if (!classic) return []

  const selected = new Set(positions)
  return classic.lines.filter((line) => selected.has(line.position))
}
