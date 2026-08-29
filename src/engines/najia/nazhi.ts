export type NazhiPair = readonly [string, string]

export interface TrigramNazhi {
  inner: readonly NazhiPair[]
  outer: readonly NazhiPair[]
}

// 三画卦纳支表：inner=下卦（初/二/三爻），outer=上卦（四/五/上爻）。
// 数据移植自来源项目 D:\HexaAgent\backend\app\core\najia.py。
export const TRIGRAM_NAZHI: Record<string, TrigramNazhi> = {
  乾: { inner: [['甲', '子'], ['甲', '寅'], ['甲', '辰']], outer: [['壬', '午'], ['壬', '申'], ['壬', '戌']] },
  坎: { inner: [['戊', '寅'], ['戊', '辰'], ['戊', '午']], outer: [['戊', '申'], ['戊', '戌'], ['戊', '子']] },
  艮: { inner: [['丙', '辰'], ['丙', '午'], ['丙', '申']], outer: [['丙', '戌'], ['丙', '子'], ['丙', '寅']] },
  震: { inner: [['庚', '子'], ['庚', '寅'], ['庚', '辰']], outer: [['庚', '午'], ['庚', '申'], ['庚', '戌']] },
  巽: { inner: [['辛', '丑'], ['辛', '亥'], ['辛', '酉']], outer: [['辛', '未'], ['辛', '巳'], ['辛', '卯']] },
  离: { inner: [['己', '卯'], ['己', '丑'], ['己', '亥']], outer: [['己', '酉'], ['己', '未'], ['己', '巳']] },
  坤: { inner: [['乙', '未'], ['乙', '巳'], ['乙', '卯']], outer: [['癸', '丑'], ['癸', '亥'], ['癸', '酉']] },
  兑: { inner: [['丁', '巳'], ['丁', '卯'], ['丁', '丑']], outer: [['丁', '亥'], ['丁', '酉'], ['丁', '未']] },
}

/** 上下卦 → 六爻纳甲（[gan, zhi] × 6，index 0 = 初爻） */
export function getHexagramNazhi(upperTrigram: string, lowerTrigram: string): NazhiPair[] {
  const lowerData = TRIGRAM_NAZHI[lowerTrigram]
  const upperData = TRIGRAM_NAZHI[upperTrigram]
  if (!lowerData || !upperData) {
    throw new Error(`未知三画卦纳支: 上卦${upperTrigram} 下卦${lowerTrigram}`)
  }
  return [...lowerData.inner, ...upperData.outer]
}
