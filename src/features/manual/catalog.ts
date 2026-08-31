import type { RawYaoValue } from '../../domain/types'
import { HEXAGRAM_TABLE, type HexagramTableEntry } from '../../engines/hexagram/table'
import { trigramLines } from '../../engines/hexagram/trigrams'

export type { HexagramTableEntry }

const CATALOG = [...HEXAGRAM_TABLE.values()]

export function searchHexagrams(query: string): readonly HexagramTableEntry[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return CATALOG
  return CATALOG.filter((entry) => entry.name.toLowerCase().includes(normalized))
}

export function rawValuesForHexagram(name: string): readonly RawYaoValue[] {
  const entry = CATALOG.find((item) => item.name === name)
  if (!entry) throw new Error(`未知卦名: ${name}`)
  return [...trigramLines(entry.lowerTrigram), ...trigramLines(entry.upperTrigram)].map((type) =>
    type === 'yang' ? 7 : 8,
  )
}
