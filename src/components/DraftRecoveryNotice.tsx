/**
 * 未完成草稿的恢复提示：只描述"已恢复"，清空动作由页面放进固定操作栏。
 * 文案是确认过的固定版本，改文案前先确认产品口径。
 */
export function DraftRecoveryNotice() {
  return (
    <aside className="draft-recovery-notice" role="status">
      <span className="draft-recovery-notice__icon" aria-hidden="true">↺</span>
      <p>已恢复上次未完成的卦，可以选择继续完成，也可以开始新一卦。</p>
    </aside>
  )
}
