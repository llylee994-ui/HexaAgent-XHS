export const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const

export const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const

// 天干五行：甲乙木、丙丁火、戊己土、庚辛金、壬癸水
export const GAN_WUXING: Record<string, string> = {
  甲: '木', 乙: '木',
  丙: '火', 丁: '火',
  戊: '土', 己: '土',
  庚: '金', 辛: '金',
  壬: '水', 癸: '水',
}

// 地支五行：寅卯木、巳午火、申酉金、亥子水、辰戌丑未土
export const ZHI_WUXING: Record<string, string> = {
  子: '水', 丑: '土',
  寅: '木', 卯: '木',
  辰: '土', 巳: '火',
  午: '火', 未: '土',
  申: '金', 酉: '金',
  戌: '土', 亥: '水',
}

// 五虎遁（年上起月）：年干 → 正月（寅月）月干
const WU_HU_DUN: Record<string, string> = {
  甲: '丙', 己: '丙',
  乙: '戊', 庚: '戊',
  丙: '庚', 辛: '庚',
  丁: '壬', 壬: '壬',
  戊: '甲', 癸: '甲',
}

// 五鼠遁（日上起时）：日干 → 子时时干
const WU_SHU_DUN: Record<string, string> = {
  甲: '甲', 己: '甲',
  乙: '丙', 庚: '丙',
  丙: '戊', 辛: '戊',
  丁: '庚', 壬: '庚',
  戊: '壬', 癸: '壬',
}

// 六十甲子表（干支纪年/纪日）
export const JIAZI_TABLE: readonly string[] = Array.from(
  { length: 60 },
  (_, i) => `${TIAN_GAN[i % 10]}${DI_ZHI[i % 12]}`,
)

// 六甲旬空表：旬首 → 该旬缺失的两个地支
const XUN_KONG_TABLE: Record<string, readonly string[]> = {
  甲子: ['戌', '亥'],
  甲戌: ['申', '酉'],
  甲申: ['午', '未'],
  甲午: ['辰', '巳'],
  甲辰: ['寅', '卯'],
  甲寅: ['子', '丑'],
}

export function ganIndex(gan: string): number {
  const index = TIAN_GAN.indexOf(gan as (typeof TIAN_GAN)[number])
  if (index < 0) {
    throw new Error(`未知天干: ${gan}`)
  }
  return index
}

export function zhiIndex(zhi: string): number {
  const index = DI_ZHI.indexOf(zhi as (typeof DI_ZHI)[number])
  if (index < 0) {
    throw new Error(`未知地支: ${zhi}`)
  }
  return index
}

export function getGanWuxing(gan: string): string {
  return GAN_WUXING[gan] ?? ''
}

export function getZhiWuxing(zhi: string): string {
  return ZHI_WUXING[zhi] ?? ''
}

/** 日柱干支 → 旬空的两个地支 */
export function getXunKong(dayPillar: string): readonly [string, string] {
  const gan = dayPillar[0]
  const zhi = dayPillar[1]
  // 从当前天干回到最近的甲，得到旬首地支
  const offset = ganIndex(gan)
  const jiaZhi = DI_ZHI[(zhiIndex(zhi) - offset + 12) % 12]
  const xunKong = XUN_KONG_TABLE[`甲${jiaZhi}`]
  if (!xunKong) {
    throw new Error(`无法确定旬空: ${dayPillar}`)
  }
  return [xunKong[0], xunKong[1]]
}

/** 五虎遁：年干 + 月支索引（寅月=0）→ 月干 */
export function yueGan(yearGan: string, monthZhiIndex: number): string {
  const startGan = WU_HU_DUN[yearGan]
  if (!startGan) {
    throw new Error(`未知年干: ${yearGan}`)
  }
  return TIAN_GAN[(ganIndex(startGan) + monthZhiIndex) % 10]
}

/** 五鼠遁：日干 + 时支索引（子时=0）→ 时干 */
export function shiGan(dayGan: string, hourZhiIndex: number): string {
  const startGan = WU_SHU_DUN[dayGan]
  if (!startGan) {
    throw new Error(`未知日干: ${dayGan}`)
  }
  return TIAN_GAN[(ganIndex(startGan) + hourZhiIndex) % 10]
}
