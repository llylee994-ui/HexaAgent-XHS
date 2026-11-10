/**
 * 固定操作栏的草稿状态文案。
 * 只有真的写进 localStorage 才能说"已自动保存"；失败时必须明确让用户别退出。
 */
export const DRAFT_SAVED_HINT = '当前内容已自动保存'
export const DRAFT_FAILED_HINT = '草稿未保存，请勿退出'

export type DraftHintTone = 'default' | 'warning'

export function draftHint(failed: boolean): { hint: string; hintTone: DraftHintTone } {
  return failed
    ? { hint: DRAFT_FAILED_HINT, hintTone: 'warning' }
    : { hint: DRAFT_SAVED_HINT, hintTone: 'default' }
}
