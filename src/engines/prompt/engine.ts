import type { DivinationCase, PromptSnapshot, PromptVariant } from '../../domain/types'
import { PROMPT_VERSION } from '../../domain/versions'
import { YONGSHEN_BY_CATEGORY } from '../interpretation/categories'
import { isSizhuOverridden } from '../najia/chart'
import {
  formatCastRules,
  formatCastTime,
  formatCastZone,
  formatCategory,
  formatCoinThrows,
  formatReadableChart,
  formatMethod,
  formatSizhu,
} from './formatter'
import { buildStructuredPromptData } from './structured'
import { PROMPT_CONSTRAINTS, PROMPT_FOOTER, PROMPT_HEADER } from './templates'

/** 四柱行：人工校正过的四柱必须标明，否则外部 AI 会以为它是按起卦时间推算出来的 */
function sizhuLine(caseValue: DivinationCase): string {
  const chart = caseValue.chart
  if (!chart) return '四柱：—'
  const overridden = isSizhuOverridden(caseValue.castAt, chart, caseValue.timeZone)
  return `四柱：${formatSizhu(chart.sizhu)}${overridden ? '（人工校正，非按起卦时间推算）' : ''}`
}

function commonHeader(caseValue: DivinationCase, variant: PromptVariant): string[] {
  const lines = [
    PROMPT_HEADER[variant],
    `问题：${caseValue.question}`,
    `类别：${formatCategory(caseValue.category)}`,
    `起卦时间：${formatCastTime(caseValue.castAt, caseValue.timeZone)}`,
    `排盘时区：${formatCastZone(caseValue.timeZone)}`,
    `起卦方式：${formatMethod(caseValue.method)}`,
    ...formatCastRules(),
  ]
  if (caseValue.note) {
    lines.push(`备注：${caseValue.note}`)
  }
  return lines
}

function conciseBody(caseValue: DivinationCase): string[] {
  const chart = caseValue.chart
  if (!chart) return ['（排盘尚未完成）']
  const changing = chart.changingLines.length
    ? `动爻：第${chart.changingLines.join('、第')}爻`
    : '静卦（无动爻）'
  return [
    `本卦：${chart.original.name}（${chart.original.palace}宫）`,
    chart.changed ? `变卦：${chart.changed.name}` : '静卦',
    changing,
    sizhuLine(caseValue),
    `月建：${chart.sizhu.month[1]} 日辰：${chart.sizhu.day[1]}`,
    `旬空：${chart.xunKong[0]}${chart.xunKong[1]}`,
    `用神：${YONGSHEN_BY_CATEGORY[caseValue.category].primary.join(' / ')}`,
  ]
}

function professionalBody(caseValue: DivinationCase): string[] {
  const chart = caseValue.chart
  if (!chart) return ['（排盘尚未完成）']

  const lines: string[] = []
  if (caseValue.coinThrows.length > 0) {
    lines.push('原始投币：', ...formatCoinThrows(caseValue.coinThrows).map((line) => `  ${line}`))
  } else {
    lines.push(`原始爻值：${caseValue.rawValues.join('、')}`)
  }

  lines.push('', '人类可读排盘：', ...formatReadableChart(caseValue), '', '结构化排盘数据：', '```json', JSON.stringify(buildStructuredPromptData(caseValue), null, 2), '```')
  lines.push(
    '',
    sizhuLine(caseValue),
    `月建：${chart.sizhu.month[1]} 日辰：${chart.sizhu.day[1]}`,
    `旬空：${chart.xunKong[0]}${chart.xunKong[1]}`,
    `用神：${YONGSHEN_BY_CATEGORY[caseValue.category].primary.join(' / ')}`,
    `说明：${YONGSHEN_BY_CATEGORY[caseValue.category].note ?? ''}`,
  )

  if (caseValue.observations.length > 0) {
    lines.push('', '离线规则观察（非 AI 结论，仅供参考）：')
    for (const item of caseValue.observations) {
      lines.push(`  [${item.ruleId}] ${item.observation}`)
      lines.push(`    依据：${item.basis}`)
    }
  }
  if (caseValue.note) {
    lines.push(`专业备注：${caseValue.note}`)
  }
  return lines
}

/**
 * 生成提示词快照。精简版只含问题、时间、卦名、动爻与关键排盘；
 * 专业版额外包含原始投币、完整排盘、规则依据与七条输出约束。
 * 每次生成保存版本号与完整文本，回答据此关联。
 */
export function generatePrompt(caseValue: DivinationCase, variant: PromptVariant): PromptSnapshot {
  const body = variant === 'concise' ? conciseBody(caseValue) : professionalBody(caseValue)
  const lines = [...commonHeader(caseValue, variant), '', ...body]

  if (variant === 'professional') {
    lines.push('', PROMPT_FOOTER.professional)
    PROMPT_CONSTRAINTS.forEach((constraint, index) => {
      lines.push(`${index + 1}. ${constraint}`)
    })
    lines.push('', '请在回答末尾用一段话总结，并附"仅供参考"声明。')
  } else {
    lines.push('', PROMPT_FOOTER.concise)
  }

  return {
    id: crypto.randomUUID(),
    variant,
    version: PROMPT_VERSION,
    content: lines.join('\n'),
    createdAt: new Date().toISOString(),
  }
}
