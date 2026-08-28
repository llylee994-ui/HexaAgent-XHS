import type { LinePosition } from '../../domain/types'
import { trigramElement } from './trigrams'

export interface HexagramTableEntry {
  name: string
  upperTrigram: string
  lowerTrigram: string
  palace: string
  palaceElement: string
  shiPosition: LinePosition
}

// 六十四卦表，键为 `${upper},${lower}`；世爻位：八纯=6，一世=1 … 五世=5，游魂=4，归魂=3。
// 数据移植自来源项目 D:\HexaAgent\backend\app\core\bagua.py 的八宫卦序。
const RAW_TABLE: readonly [string, string, string, string, LinePosition][] = [
  // ─ 乾宫
  ['乾', '乾', '乾为天', '乾', 6],
  ['乾', '巽', '天风姤', '乾', 1],
  ['乾', '艮', '天山遁', '乾', 2],
  ['乾', '坤', '天地否', '乾', 3],
  ['巽', '坤', '风地观', '乾', 4],
  ['艮', '坤', '山地剥', '乾', 5],
  ['离', '坤', '火地晋', '乾', 4],
  ['离', '乾', '火天大有', '乾', 3],
  // ─ 坎宫
  ['坎', '坎', '坎为水', '坎', 6],
  ['坎', '兑', '水泽节', '坎', 1],
  ['坎', '震', '水雷屯', '坎', 2],
  ['坎', '离', '水火既济', '坎', 3],
  ['兑', '离', '泽火革', '坎', 4],
  ['震', '离', '雷火丰', '坎', 5],
  ['坤', '离', '地火明夷', '坎', 4],
  ['坤', '坎', '地水师', '坎', 3],
  // ─ 艮宫
  ['艮', '艮', '艮为山', '艮', 6],
  ['艮', '离', '山火贲', '艮', 1],
  ['艮', '乾', '山天大畜', '艮', 2],
  ['艮', '兑', '山泽损', '艮', 3],
  ['离', '兑', '火泽睽', '艮', 4],
  ['乾', '兑', '天泽履', '艮', 5],
  ['巽', '兑', '风泽中孚', '艮', 4],
  ['巽', '艮', '风山渐', '艮', 3],
  // ─ 震宫
  ['震', '震', '震为雷', '震', 6],
  ['震', '坤', '雷地豫', '震', 1],
  ['震', '坎', '雷水解', '震', 2],
  ['震', '巽', '雷风恒', '震', 3],
  ['坤', '巽', '地风升', '震', 4],
  ['坎', '巽', '水风井', '震', 5],
  ['兑', '巽', '泽风大过', '震', 4],
  ['兑', '震', '泽雷随', '震', 3],
  // ─ 巽宫
  ['巽', '巽', '巽为风', '巽', 6],
  ['巽', '乾', '风天小畜', '巽', 1],
  ['巽', '离', '风火家人', '巽', 2],
  ['巽', '震', '风雷益', '巽', 3],
  ['乾', '震', '天雷无妄', '巽', 4],
  ['离', '震', '火雷噬嗑', '巽', 5],
  ['艮', '震', '山雷颐', '巽', 4],
  ['艮', '巽', '山风蛊', '巽', 3],
  // ─ 离宫
  ['离', '离', '离为火', '离', 6],
  ['离', '艮', '火山旅', '离', 1],
  ['离', '巽', '火风鼎', '离', 2],
  ['离', '坎', '火水未济', '离', 3],
  ['艮', '坎', '山水蒙', '离', 4],
  ['巽', '坎', '风水涣', '离', 5],
  ['乾', '坎', '天水讼', '离', 4],
  ['乾', '离', '天火同人', '离', 3],
  // ─ 坤宫
  ['坤', '坤', '坤为地', '坤', 6],
  ['坤', '震', '地雷复', '坤', 1],
  ['坤', '兑', '地泽临', '坤', 2],
  ['坤', '乾', '地天泰', '坤', 3],
  ['震', '乾', '雷天大壮', '坤', 4],
  ['兑', '乾', '泽天夬', '坤', 5],
  ['坎', '乾', '水天需', '坤', 4],
  ['坎', '坤', '水地比', '坤', 3],
  // ─ 兑宫
  ['兑', '兑', '兑为泽', '兑', 6],
  ['兑', '坎', '泽水困', '兑', 1],
  ['兑', '坤', '泽地萃', '兑', 2],
  ['兑', '艮', '泽山咸', '兑', 3],
  ['坎', '艮', '水山蹇', '兑', 4],
  ['坤', '艮', '地山谦', '兑', 5],
  ['震', '艮', '雷山小过', '兑', 4],
  ['震', '兑', '雷泽归妹', '兑', 3],
]

function buildTable(): Map<string, HexagramTableEntry> {
  const table = new Map<string, HexagramTableEntry>()
  for (const [upper, lower, name, palace, shiPosition] of RAW_TABLE) {
    const key = `${upper},${lower}`
    if (table.has(key)) {
      throw new Error(`六十四卦表键重复: ${key}`)
    }
    table.set(key, {
      name,
      upperTrigram: upper,
      lowerTrigram: lower,
      palace,
      palaceElement: trigramElement(palace),
      shiPosition,
    })
  }
  return table
}

export const HEXAGRAM_TABLE: ReadonlyMap<string, HexagramTableEntry> = buildTable()

export function findHexagramEntry(upper: string, lower: string): HexagramTableEntry | undefined {
  return HEXAGRAM_TABLE.get(`${upper},${lower}`)
}

export function getHexagramEntry(upper: string, lower: string): HexagramTableEntry {
  const entry = findHexagramEntry(upper, lower)
  if (!entry) {
    throw new Error(`未知卦象组合: 上卦${upper} 下卦${lower}`)
  }
  return entry
}
