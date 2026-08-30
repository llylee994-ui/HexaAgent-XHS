import type { CaseStatus } from '../../domain/types'

/** 卦例状态 → 时间线标签 */
export const STATUS_LABEL: Record<CaseStatus, string> = {
  draft: '草稿',
  cast: '仅排盘',
  prompted: '已生成提示词',
  answered: '已保存 AI 回答',
  verified: '已补充后续验证',
}
