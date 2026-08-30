import type { PromptVariant } from '../../domain/types'

/** 对外部 AI 的七条输出约束（设计规格 §12.2） */
export const PROMPT_CONSTRAINTS: readonly string[] = [
  '先确认用神选择，如认为用神选择不当请说明你的依据。',
  '逐条引用卦象数据作为依据，不要凭空推断。',
  '区分本卦、动爻和变卦，说明各自代表的含义。',
  '不编造未提供的数据，缺什么就说明缺什么。',
  '信息不足或信号冲突时，明确说明不确定性，不要强行给出结论。',
  '最后用通俗语言总结，让不了解六爻的人也能看懂。',
  '对健康、法律和财务问题，避免给出替代专业意见的结论。',
]

export const PROMPT_HEADER: Record<PromptVariant, string> = {
  concise: '【六爻起卦 · 精简版】',
  professional: '【六爻起卦 · 专业版】',
}

export const PROMPT_FOOTER: Record<PromptVariant, string> = {
  concise: '请结合以上卦象简要解读，并说明判断的不确定性。仅供传统文化研究参考。',
  professional: '请严格按以下要求输出：',
}

export const METHOD_LABEL = {
  'simulated-coins': '页面模拟铜钱',
  'physical-coins': '现实投币录入',
  manual: '手动排盘',
} as const

export const CATEGORY_LABEL: Record<string, string> = {
  career: '事业/求职',
  wealth: '财运/交易',
  relationship: '感情/婚姻',
  study: '学业/考试',
  health: '健康',
  dispute: '官司/纠纷',
  travel: '出行',
  'lost-item': '失物',
  other: '其他',
}
