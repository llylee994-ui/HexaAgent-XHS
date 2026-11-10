import { useState } from 'react'
import type { DivinationCase } from '../../domain/types'
import { CAST_TIME_ZONE } from '../../domain/time-zone'
import { useCaseSession } from '../../app/use-case-session'
import type { PageFrameBinding } from '../../app/navigation'
import { DETACHED_FRAME } from '../../app/navigation'
import { ConfirmDialog, DraftRecoveryNotice, PageActionBar, PageFrame, ProgressHeader, YaoStack } from '../../components'
import { buildHexagram } from '../../engines/hexagram/engine'
import type { CoinFaces } from '../../engines/divination/coins'
import { throwCoins } from '../../engines/divination/coins'
import { SUPPORTED_YEAR_RANGE } from '../../engines/calendar/solar-terms'
import { parseZonedInput, toZonedInputValue } from '../../engines/calendar/zoned-time'
import { QuestionStep } from './QuestionStep'
import { MethodStep } from './MethodStep'
import { CoinStage } from './CoinStage'
import { PhysicalCoinStage } from './PhysicalCoinStage'
import { draftHint } from '../shared/draft-hint'

export interface CastPageProps {
  onCaseCreated(caseValue: DivinationCase): void
  frame?: PageFrameBinding
}

const FRESH_FACES: CoinFaces = [0, 0, 0]

/** 现场摇卦页：问题 → 方式 → 投币 → 结果确认 */
export function CastPage({ onCaseCreated, frame = DETACHED_FRAME }: CastPageProps) {
  const session = useCaseSession()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [newCastOpen, setNewCastOpen] = useState(false)
  // 本轮尚未确认的铜钱面由页面持有：主操作在固定栏，铜钱区只负责展示
  const [simulatedFaces, setSimulatedFaces] = useState<CoinFaces>(FRESH_FACES)
  const [physicalFaces, setPhysicalFaces] = useState<CoinFaces>(FRESH_FACES)
  const stepTitle = session.step === 'method' ? '选择起卦方式' : '现场摇卦'

  const throwSimulatedRound = () => {
    const next = throwCoins()
    setSimulatedFaces(next)
    session.addCoinRound(next)
  }

  const flipPhysicalCoin = (index: 0 | 1 | 2) => {
    setPhysicalFaces((previous) => {
      const next = [...previous] as [0 | 1, 0 | 1, 0 | 1]
      next[index] = previous[index] === 1 ? 0 : 1
      return next
    })
  }

  const confirmPhysicalRound = () => {
    session.addCoinRound(physicalFaces)
    setPhysicalFaces(FRESH_FACES)
  }

  const discardAndRestart = () => {
    session.discardDraft()
    setSimulatedFaces(FRESH_FACES)
    setPhysicalFaces(FRESH_FACES)
    setNewCastOpen(false)
  }

  if (session.step === 'question') {
    return (
      <PageFrame title={stepTitle} canGoBack={frame.canGoBack} direction={frame.direction} onBack={frame.onBack}>
        <section className="page">
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
      </PageFrame>
    )
  }

  if (session.step === 'method') {
    return (
      <PageFrame title={stepTitle} canGoBack={frame.canGoBack} direction={frame.direction} onBack={frame.onBack}>
        <section className="page">
          <MethodStep onSelect={session.chooseMethod} />
        </section>
      </PageFrame>
    )
  }

  const preview = session.isComplete ? buildHexagram(session.rawValues) : null
  const nextRound = session.rawValues.length + 1
  const hint = draftHint(session.draftSaveFailed)

  return (
    <PageFrame title={stepTitle} canGoBack={frame.canGoBack} direction={frame.direction} onBack={frame.onBack}>
      <section className="page">
        {session.wasRestored ? <DraftRecoveryNotice /> : null}

        <ProgressHeader question={session.question} completedCount={session.rawValues.length} />

        {session.step === 'casting' ? (
          session.method === 'physical-coins' ? (
            <PhysicalCoinStage faces={physicalFaces} onFlip={flipPhysicalCoin} />
          ) : (
            <CoinStage faces={simulatedFaces} />
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
            <label className="field field--inline">
              <span className="field__label">起卦时间（北京时间）</span>
              <input
                aria-label="起卦时间"
                type="datetime-local"
                min={`${SUPPORTED_YEAR_RANGE.fromYear}-01-01T00:00`}
                max={`${SUPPORTED_YEAR_RANGE.toYear}-12-31T23:59`}
                value={toZonedInputValue(session.castAt, CAST_TIME_ZONE.offsetMinutes)}
                onChange={(event) => {
                  const iso = parseZonedInput(event.target.value, CAST_TIME_ZONE.offsetMinutes)
                  if (iso) session.setCastAt(iso)
                }}
              />
            </label>
            <p className="review-panel__line">起卦时间默认取六爻齐备（得卦）的时刻，如不准确可在此校正。</p>
            <button type="button" className="btn btn--small" onClick={() => session.setCastAt(new Date().toISOString())}>
              使用当前时间
            </button>
            <button type="button" className="btn" onClick={() => setConfirmOpen(true)}>
              修改卦象
            </button>
          </div>
        ) : null}

        {session.isComplete ? (
          <PageActionBar
            secondary={<button type="button" className="btn" onClick={() => setNewCastOpen(true)}>开始新一卦</button>}
            primary={
              <button type="button" className="btn btn--primary" onClick={() => onCaseCreated(session.completeCast())}>
                生成结果
              </button>
            }
            hint={hint.hint}
            hintTone={hint.hintTone}
          />
        ) : (
          <PageActionBar
            secondary={<button type="button" className="btn" onClick={() => setNewCastOpen(true)}>开始新一卦</button>}
            primary={session.method === 'physical-coins' ? (
              <button type="button" className="btn btn--primary" aria-label="确认本轮" onClick={confirmPhysicalRound}>
                确认本轮 · 第 {nextRound} 轮
              </button>
            ) : (
              <button type="button" className="btn btn--primary" aria-label="摇动铜钱" onClick={throwSimulatedRound}>
                摇动铜钱 · 第 {nextRound} 轮
              </button>
            )}
            hint={hint.hint}
            hintTone={hint.hintTone}
          />
        )}

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
