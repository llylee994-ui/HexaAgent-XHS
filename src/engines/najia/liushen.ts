export const LIUSHEN = ['青龙', '朱雀', '勾陈', '腾蛇', '白虎', '玄武'] as const

// 日干 → 初爻六神起位索引
const LIUSHEN_START: Record<string, number> = {
  甲: 0, 乙: 0,
  丙: 1, 丁: 1,
  戊: 2,
  己: 3,
  庚: 4, 辛: 4,
  壬: 5, 癸: 5,
}

/** 日干 → 六爻六神（index 0 = 初爻） */
export function getLiushenByDayGan(dayGan: string): string[] {
  const start = LIUSHEN_START[dayGan]
  if (start === undefined) {
    throw new Error(`未知日干: ${dayGan}`)
  }
  return Array.from({ length: 6 }, (_, i) => LIUSHEN[(start + i) % 6])
}
