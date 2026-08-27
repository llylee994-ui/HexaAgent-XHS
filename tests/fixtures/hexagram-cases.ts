import type { RawYaoValue } from '../../src/domain/types'

export interface FixedHexagramCase {
  name: string
  rawValues: readonly RawYaoValue[]
  originalName: string
  changedName: string | null
  changingLines: readonly (1 | 2 | 3 | 4 | 5 | 6)[]
  originalPalace: string
}

export const FIXED_HEXAGRAM_CASES: readonly FixedHexagramCase[] = [
  {
    name: '乾为天静卦',
    rawValues: [7, 7, 7, 7, 7, 7],
    originalName: '乾为天',
    changedName: null,
    changingLines: [],
    originalPalace: '乾',
  },
  {
    name: '坤为地六爻皆动',
    rawValues: [6, 6, 6, 6, 6, 6],
    originalName: '坤为地',
    changedName: '乾为天',
    changingLines: [1, 2, 3, 4, 5, 6],
    originalPalace: '坤',
  },
  {
    name: '天风姤初爻动',
    rawValues: [6, 7, 7, 7, 7, 7],
    originalName: '天风姤',
    changedName: '乾为天',
    changingLines: [1],
    originalPalace: '乾',
  },
  {
    name: '乾为天初二爻动',
    rawValues: [9, 9, 7, 7, 7, 7],
    originalName: '乾为天',
    changedName: '天山遁',
    changingLines: [1, 2],
    originalPalace: '乾',
  },
]
