import { useState } from 'react'
import type { DivinationCase } from '../../domain/types'
import type { PageFrameBinding } from '../../app/navigation'
import { DETACHED_FRAME } from '../../app/navigation'
import { ConfirmDialog, DraftRecoveryNotice, PageActionBar, PageFrame } from '../../components'
import { QuestionStep } from '../cast/QuestionStep'
import { QUESTION_CATEGORY_OPTIONS } from '../shared/categories'
import { HexagramSearch } from './HexagramSearch'
import { ManualValidationSummary } from './ManualValidationSummary'
import { SizhuEditor } from './SizhuEditor'
import { useManualEditor } from './use-manual-editor'
import { YaoEditor } from './YaoEditor'
import { draftHint } from '../shared/draft-hint'

export interface ManualPageProps {
  onCaseCreated(caseValue: DivinationCase): void
  frame?: PageFrameBinding
}

const STATUS_LABEL = {
  idle: undefined,
  'auto-filled': '已自动排盘',
  corrected: '已校正',
  'time-updated': '已按新时间重算',
  saved: '草稿已保存',
  error: '尚未保存，请检查错误',
} as const

export function ManualPage({ onCaseCreated, frame = DETACHED_FRAME }: ManualPageProps) {
  const controller = useManualEditor(frame.direction)
  const [restoreAllOpen, setRestoreAllOpen] = useState(false)
  const [newCastOpen, setNewCastOpen] = useState(false)

  const focusFirstIssue = () => {
    const first = controller.issues[0]
    if (!first) return
    const id = first.section === 'question' ? 'manual-question-error' : first.section === 'sizhu' ? 'manual-sizhu-error' : `manual-line-${first.position ?? 0}-error`
    const target = document.getElementById(id)
    if (!target) return
    target.focus()
    target.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

  if (!controller.state.question.trim()) {
    return (
      <PageFrame title="手动排盘" canGoBack={frame.canGoBack} direction={frame.direction} onBack={frame.onBack}>
        <section className="page">
          <QuestionStep
            initialQuestion={controller.state.question}
            initialCategory={controller.state.category}
            initialNote={controller.state.note}
            onSubmit={(input) => controller.setQuestion(input.question, input.category, input.note)}
          />
        </section>
      </PageFrame>
    )
  }

  const complete = () => {
    const result = controller.complete()
    if (result) onCaseCreated(result)
  }

  const discardAndRestart = () => {
    controller.discardDraft()
    setNewCastOpen(false)
  }

  const hint = draftHint(controller.draftSaveFailed)

  return (
    <PageFrame title="手动排盘" canGoBack={frame.canGoBack} direction={frame.direction} status={STATUS_LABEL[controller.status]} onBack={frame.onBack}>
      <section className="page manual-page">
        {controller.wasRestored ? <DraftRecoveryNotice /> : null}

        <section className="manual-section manual-question" aria-label="问题信息">
          <h2 className="section-title">问题信息</h2>
          <label className="field">
            <span className="field__label">你的问题</span>
            <input aria-label="你的问题" value={controller.state.question} onChange={(event) => controller.setQuestion(event.target.value, controller.state.category, controller.state.note)} />
          </label>
          <label className="field">
            <span className="field__label">问题类别</span>
            <select aria-label="问题类别" aria-describedby="question-category-hint" value={controller.state.category} onChange={(event) => controller.setQuestion(controller.state.question, event.target.value as typeof controller.state.category, controller.state.note)}>
              <option value="">请选择类别</option>
              {QUESTION_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <p id="question-category-hint" className="hint">类别用于推荐主用神候选，具体仍需结合问题确认。</p>
          <label className="field">
            <span className="field__label">补充说明</span>
            <textarea aria-label="补充说明" value={controller.state.note} onChange={(event) => controller.setQuestion(controller.state.question, controller.state.category, event.target.value)} rows={2} />
          </label>
        </section>

        <HexagramSearch value={controller.state.selectedHexagramName} onSelect={controller.selectHexagram} />
        {controller.chart ? <p className="review-panel__line">本卦：{controller.chart.original.name}</p> : null}
        <SizhuEditor controller={controller} chart={controller.chart} />
        {controller.chart ? <YaoEditor controller={controller} chart={controller.chart} /> : <p id="manual-sizhu-error" className="hint hint--warning">请检查起卦时间后再排盘。</p>}

        <ManualValidationSummary issues={controller.issues} onFocusFirst={focusFirstIssue} />
        <div className="page__actions">
          <button type="button" className={`btn ${controller.status === 'saved' ? 'is-success' : ''}`} onClick={controller.saveDraft}>保存草稿</button>
        </div>
        <button type="button" className="btn" onClick={() => setRestoreAllOpen(true)}>恢复全部自动值</button>

        <PageActionBar
          secondary={<button type="button" className="btn" onClick={() => setNewCastOpen(true)}>开始新一卦</button>}
          primary={
            <button type="button" className="btn btn--primary" onClick={complete} disabled={controller.issues.length > 0 || !controller.chart}>
              生成正式结果
            </button>
          }
          hint={hint.hint}
          hintTone={hint.hintTone}
        />

        <ConfirmDialog
          open={restoreAllOpen}
          title="恢复全部自动值"
          message="将清除所有人工校正，恢复排盘引擎的自动结果。"
          confirmText="确认恢复"
          onConfirm={() => { controller.restoreAll(); setRestoreAllOpen(false) }}
          onCancel={() => setRestoreAllOpen(false)}
        />
        <ConfirmDialog
          open={newCastOpen}
          title="开始新一卦？"
          message="当前未完成的内容会被清空，且无法恢复。"
          confirmText="清空并重新开始"
          cancelText="继续当前卦"
          onConfirm={discardAndRestart}
          onCancel={() => setNewCastOpen(false)}
        />
      </section>
    </PageFrame>
  )
}
