import type { DivinationCase, HexagramChart, InterpretationObservation, QuestionCategory, YaoLine } from '../../domain/types'
import { YONGSHEN_BY_CATEGORY, type YongshenSpec } from './categories'
import { disclaimersFor } from './disclaimers'
import { RULES, type RuleContext } from './rules'

export interface InterpretationResult {
  category: QuestionCategory
  yongshen: readonly string[]
  observations: readonly InterpretationObservation[]
  summary: string
  disclaimers: readonly string[]
}

function buildContext(chart: HexagramChart, spec: YongshenSpec): RuleContext {
  const yongshenLines: YaoLine[] =
    spec.primary[0] === '世爻'
      ? chart.original.lines.filter((line) => line.shiYing === 'shi')
      : chart.original.lines.filter((line) => spec.primary.includes(line.liuqin))

  const yongshenFushen =
    spec.primary[0] === '世爻'
      ? []
      : chart.original.lines
          .filter((line) => line.fushen && spec.primary.includes(line.fushen.liuqin))
          .map((line) => ({ line, liuqin: line.fushen!.liuqin, zhi: line.fushen!.zhi }))

  return {
    chart,
    spec,
    yueJian: chart.sizhu.month[1],
    riChen: chart.sizhu.day[1],
    yongshenLines,
    yongshenFushen,
  }
}

function buildSummary(observations: readonly InterpretationObservation[]): string {
  const supportive = observations.filter((o) => o.tendency === 'supportive').length
  const resistant = observations.filter((o) => o.tendency === 'resistant').length
  if (supportive > 0 && resistant > 0) {
    return '信号复杂，无法仅凭离线规则形成明确倾向，请结合完整卦象与外部解读综合判断。'
  }
  if (supportive > 0) {
    return '离线规则显示支持性信号较多，整体倾向平稳向好，具体仍需结合卦象整体判断。'
  }
  if (resistant > 0) {
    return '离线规则显示阻力信号较多，建议保持谨慎，等待条件成熟。'
  }
  return '离线规则未发现明显倾向，本结果仅为规则观察记录，仅供参考。'
}

/**
 * 可解释的离线规则初判。不是 AI，也不冒充完整断卦：
 * 每条结果都带规则编号，冲突时明确说明无法形成倾向。
 */
export function interpret(chart: HexagramChart, category: QuestionCategory): InterpretationResult {
  const spec = YONGSHEN_BY_CATEGORY[category]
  const context = buildContext(chart, spec)

  const observations: InterpretationObservation[] = []
  for (const rule of RULES) {
    observations.push(...rule(context))
  }

  return {
    category,
    yongshen: [...spec.primary],
    observations,
    summary: buildSummary(observations),
    disclaimers: disclaimersFor(category),
  }
}

/** 便捷封装：卦例 → 初判结果（用于结果页与提示词生成） */
export function interpretCase(caseValue: DivinationCase): InterpretationResult | null {
  if (!caseValue.chart) return null
  return interpret(caseValue.chart, caseValue.category)
}
