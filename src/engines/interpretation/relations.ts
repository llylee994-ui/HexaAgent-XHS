// 地支六冲：子午、丑未、寅申、卯酉、辰戌、巳亥
export const ZHI_LIUCHONG: Record<string, string> = {
  子: '午', 午: '子',
  丑: '未', 未: '丑',
  寅: '申', 申: '寅',
  卯: '酉', 酉: '卯',
  辰: '戌', 戌: '辰',
  巳: '亥', 亥: '巳',
}

// 地支六合
export const ZHI_LIUHE: Record<string, string> = {
  子: '丑', 丑: '子',
  寅: '亥', 亥: '寅',
  卯: '戌', 戌: '卯',
  辰: '酉', 酉: '辰',
  巳: '申', 申: '巳',
  午: '未', 未: '午',
}

// 五行相生环：木→火→土→金→水→木
const SHENG_ORDER = ['木', '火', '土', '金', '水'] as const

/** a 是否生 b */
export function sheng(a: string, b: string): boolean {
  const idx = SHENG_ORDER.indexOf(a as (typeof SHENG_ORDER)[number])
  return idx >= 0 && SHENG_ORDER[(idx + 1) % 5] === b
}

/** a 是否克 b */
export function ke(a: string, b: string): boolean {
  const idx = SHENG_ORDER.indexOf(a as (typeof SHENG_ORDER)[number])
  return idx >= 0 && SHENG_ORDER[(idx + 2) % 5] === b
}

export type Relation = 'sheng' | 'ke' | 'same' | 'other'

/** a 对 b 的五行关系 */
export function relationOf(a: string, b: string): Relation {
  if (a === b) return 'same'
  if (sheng(a, b)) return 'sheng'
  if (ke(a, b)) return 'ke'
  return 'other'
}

export const RELATION_LABEL: Record<Relation, string> = {
  sheng: '相生',
  ke: '相克',
  same: '比和',
  other: '无直接生克',
}
