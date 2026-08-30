import { useState } from 'react'
import type { DivinationCase } from '../../domain/types'
import { useCaseSession } from '../../app/use-case-session'
import { ProgressHeader, YaoStack } from '../../components'
import { buildHexagram } from '../../engines/hexagram/engine'
import { QuestionStep } from '../cast/QuestionStep'
import { QuickEntry } from './QuickEntry'
import { ProfessionalEditor } from './ProfessionalEditor'

export interface ManualPageProps {
  onCaseCreated(caseValue: DivinationCase): void
}

/** 手动排盘页：问题 → 快速录入（专业字段折叠）→ 正式结果 */
export function ManualPage({ onCaseCreated }: ManualPageProps) {
  const session = useCaseSession()
  const [editorOpen, setEditorOpen] = useState(false)

  if (session.step === 'question') {
    return (
      <section className="page">
        <h1 className="page__title">手动排盘</h1>
        <QuestionStep
          initialQuestion={session.question}
          initialCategory={session.category}
          initialNote={session.note}
          onSubmit={(input) => {
            session.setQuestion(input.question, input.category, input.note)
            session.startManualFlow()
          }}
        />
      </section>
    )
  }

  const preview = session.isComplete ? buildHexagram(session.rawValues) : null
  const missingText =
    session.missingPositions.length > 0
      ? `第 ${session.missingPositions.join('、')} 爻未填，暂不能生成正式结果`
      : null

  return (
    <section className="page">
      <ProgressHeader question={session.question} completedCount={session.rawValues.length} />

      <QuickEntry entries={session.entries} onChange={session.setEntry} />

      {missingText ? <p className="hint hint--warning">{missingText}</p> : null}

      {preview ? (
        <div className="review-panel">
          <p className="review-panel__line">本卦：{preview.original.name}</p>
          {preview.changed ? (
            <p className="review-panel__line">变卦：{preview.changed.name}</p>
          ) : (
            <p className="review-panel__line">静卦</p>
          )}
        </div>
      ) : null}

      <button type="button" className="btn" onClick={() => setEditorOpen((open) => !open)}>
        {editorOpen ? '收起专业编辑' : '展开专业编辑'}
      </button>
      {editorOpen ? (
        <ProfessionalEditor
          castAt={session.castAt}
          overrides={session.overrides}
          onCastAtChange={session.setCastAt}
          onOverridesChange={session.setOverrides}
        />
      ) : null}

      <div className="page__actions">
        <button type="button" className="btn" onClick={session.persistDraft}>
          保存草稿
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!session.isComplete}
          onClick={() => onCaseCreated(session.completeCast())}
        >
          生成正式结果
        </button>
      </div>

      <YaoStack rawValues={session.rawValues} />
    </section>
  )
}
