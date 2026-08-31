import { useState } from 'react'
import type { DivinationCase } from '../../domain/types'
import type { PageFrameBinding } from '../../app/navigation'
import { DETACHED_FRAME } from '../../app/navigation'
import { ConfirmDialog, PageFrame } from '../../components'
import { QuestionStep } from '../cast/QuestionStep'
import { HexagramSearch } from './HexagramSearch'
import { ManualValidationSummary } from './ManualValidationSummary'
import { SizhuEditor } from './SizhuEditor'
import { useManualEditor } from './use-manual-editor'
import { YaoEditor } from './YaoEditor'

export interface ManualPageProps {
  onCaseCreated(caseValue: DivinationCase): void
  frame?: PageFrameBinding
}

const STATUS_LABEL = {
  idle: undefined,
  'auto-filled': '已自动排盘',
  corrected: '已校正',
  saved: '草稿已保存',
  error: '尚未保存，请检查错误',
} as const

export function ManualPage({ onCaseCreated, frame = DETACHED_FRAME }: ManualPageProps) {
  const controller = useManualEditor()
  const [restoreAllOpen, setRestoreAllOpen] = useState(false)

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

  return (
    <PageFrame title="手动排盘" canGoBack={frame.canGoBack} direction={frame.direction} status={STATUS_LABEL[controller.status]} onBack={frame.onBack}>
      <section className="page manual-page">
        <section className="manual-section manual-question" aria-label="问题信息">
          <h2 className="section-title">问题信息</h2>
          <label className="field">
            <span className="field__label">你的问题</span>
            <input aria-label="你的问题" value={controller.state.question} onChange={(event) => controller.setQuestion(event.target.value, controller.state.category, controller.state.note)} />
          </label>
          <label className="field">
            <span className="field__label">问题类别</span>
            <select aria-label="问题类别" value={controller.state.category} onChange={(event) => controller.setQuestion(controller.state.question, event.target.value as typeof controller.state.category, controller.state.note)}>
              <option value="">请选择类别</option>
              <option value="career">事业/求职</option><option value="wealth">财运/交易</option><option value="relationship">感情/婚姻</option><option value="study">学业/考试</option><option value="health">健康</option><option value="dispute">官司/纠纷</option><option value="travel">出行</option><option value="lost-item">失物</option><option value="other">其他</option>
            </select>
          </label>
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
          <button type="button" className="btn btn--primary" onClick={complete}>生成正式结果</button>
        </div>
        <button type="button" className="btn" onClick={() => setRestoreAllOpen(true)}>恢复全部自动值</button>
        <ConfirmDialog
          open={restoreAllOpen}
          title="恢复全部自动值"
          message="将清除所有人工校正，恢复排盘引擎的自动结果。"
          confirmText="确认恢复"
          onConfirm={() => { controller.restoreAll(); setRestoreAllOpen(false) }}
          onCancel={() => setRestoreAllOpen(false)}
        />
      </section>
    </PageFrame>
  )
}
