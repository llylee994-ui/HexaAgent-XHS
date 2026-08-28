import type { YinYang } from '../../domain/types'

export interface TrigramInfo {
  name: string
  lines: readonly [YinYang, YinYang, YinYang]
  element: string
  symbol: string
}

// 八卦爻象自下而上 [初爻, 二爻, 三爻]；先天数序 1乾 2兑 3离 4震 5巽 6坎 7艮 8坤
export const TRIGRAMS: readonly TrigramInfo[] = [
  { name: '乾', lines: ['yang', 'yang', 'yang'], element: '金', symbol: '☰' },
  { name: '兑', lines: ['yang', 'yang', 'yin'], element: '金', symbol: '☱' },
  { name: '离', lines: ['yang', 'yin', 'yang'], element: '火', symbol: '☲' },
  { name: '震', lines: ['yang', 'yin', 'yin'], element: '木', symbol: '☳' },
  { name: '巽', lines: ['yin', 'yang', 'yang'], element: '木', symbol: '☴' },
  { name: '坎', lines: ['yin', 'yang', 'yin'], element: '水', symbol: '☵' },
  { name: '艮', lines: ['yin', 'yin', 'yang'], element: '土', symbol: '☶' },
  { name: '坤', lines: ['yin', 'yin', 'yin'], element: '土', symbol: '☷' },
]

const TRIGRAM_BY_NAME = new Map(TRIGRAMS.map((t) => [t.name, t]))

export function trigramLines(name: string): readonly [YinYang, YinYang, YinYang] {
  const trigram = TRIGRAM_BY_NAME.get(name)
  if (!trigram) {
    throw new Error(`未知三画卦: ${name}`)
  }
  return trigram.lines
}

export function trigramElement(name: string): string {
  const trigram = TRIGRAM_BY_NAME.get(name)
  if (!trigram) {
    throw new Error(`未知三画卦: ${name}`)
  }
  return trigram.element
}

export function findTrigramByLines(lines: readonly YinYang[]): string {
  for (const trigram of TRIGRAMS) {
    if (
      trigram.lines[0] === lines[0] &&
      trigram.lines[1] === lines[1] &&
      trigram.lines[2] === lines[2]
    ) {
      return trigram.name
    }
  }
  throw new Error(`未知爻象组合: ${lines.join(',')}`)
}
