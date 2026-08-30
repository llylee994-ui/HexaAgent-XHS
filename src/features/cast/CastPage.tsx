import { useState } from 'react'
import type { DivinationCase } from '../../domain/types'
import { useCaseSession } from '../../app/use-case-session'
import { ConfirmDialog, ProgressHeader, YaoStack } from '../../components'
import { buildHexagram } from '../../engines/hexagram/engine'
import { QuestionStep } from './QuestionStep'
import { MethodStep } from './MethodStep'
import { CoinStage } from './CoinStage'
import { PhysicalCoinStage } from './PhysicalCoinStage'

export interface CastPageProps {
  onCaseCreated(caseValue: DivinationCase): void
}

/** 现场摇卦页：问题 → 方式 → 投币 → 结果确认 */
export function CastPage({ onCaseCreated }: CastPageProps) {
  const session = useCaseSession()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (session.step === 'question') {
    return (
      <section className="page">
        <h1 className="page__title">现场摇卦</h1>
        <QuestionStep
          initialQuestion={session.question}
          initialCategory={session.category}
          initialNote={session.note}
          onSubmit={(input) => {
            session.setQuestion(input.question, input.category, input.note)
            session.startCastFlow()
          }}
        />
      </section>
    )
  }

  if (session.step === 'method') {
    return (
      <section className="page">
        <h1 className="page__title">选择起卦方式</h1>
        <MethodStep onSelect={session.chooseMethod} />
      </section>
    )
  }

  const preview = session.isComplete ? buildHexagram(session.rawValues) : null

  return (
    <section className="page">
      <ProgressHeader question={session.question} completedCount={session.rawValues.length} />

      {session.step === 'casting' ? (
        session.method === 'physical-coins' ? (
          <PhysicalCoinStage onConfirm={session.addCoinRound} />
        ) : (
          <CoinStage onThrow={session.addCoinRound} />
        )
      ) : null}

      <YaoStack rawValues={session.rawValues} />

      {session.step === 'casting' ? (
        <button
          type="button"
          className="btn"
          onClick={session.undoLastYao}
          disabled={session.rawValues.length === 0}
        >
          撤销上一爻
        </button>
      ) : null}

      {preview ? (
        <div className="review-panel">
          <p className="review-panel__line">本卦：{preview.original.name}</p>
          {preview.changed ? (
            <p className="review-panel__line">变卦：{preview.changed.name}</p>
          ) : (
            <p className="review-panel__line">静卦</p>
          )}
          <button type="button" className="btn" onClick={() => setConfirmOpen(true)}>
            修改卦象
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onCaseCreated(session.completeCast())}
          >
            生成结果
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="修改卦象"
        message="修改将回到投币状态，已投的爻可以逐爻撤销重投。确定要修改吗？"
        confirmText="确认修改"
        onConfirm={() => {
          setConfirmOpen(false)
          session.confirmModification()
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  )
}
