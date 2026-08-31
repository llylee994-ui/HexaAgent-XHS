import type { ManualValidationIssue } from './model'

export interface ManualValidationSummaryProps {
  issues: readonly ManualValidationIssue[]
  onFocusFirst(): void
}

function issueId(issue: ManualValidationIssue): string {
  if (issue.section === 'question') return 'manual-question-error'
  if (issue.section === 'sizhu') return 'manual-sizhu-error'
  return `manual-line-${issue.position ?? 0}-error`
}

export function ManualValidationSummary({ issues, onFocusFirst }: ManualValidationSummaryProps) {
  if (issues.length === 0) return null
  return (
    <section className="manual-validation" aria-label="排盘校验错误" role="alert">
      <p>请先修正以下问题：</p>
      <ul>
        {issues.map((issue, index) => <li key={`${issueId(issue)}-${index}`} id={issueId(issue)}>{issue.message}</li>)}
      </ul>
      <button type="button" className="btn btn--small" onClick={onFocusFirst}>定位第一个问题</button>
    </section>
  )
}
