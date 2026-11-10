import { useCallback, useEffect, useRef, useState } from 'react'
import type { CastMethod, CoinThrow, DivinationCase, QuestionCategory, RawYaoValue } from '../domain/types'
import { ENGINE_VERSION, SCHEMA_VERSION } from '../domain/versions'
import { CAST_TIME_ZONE } from '../domain/time-zone'
import { createId } from '../domain/ids'
import { buildChart, type ChartOverrides } from '../engines/najia/chart'
import { facesToRawValue, type CoinFaces } from '../engines/divination/coins'
import { draftStore } from '../storage/draft-store'

/**
 * 起卦会话状态机：question -> method -> casting -> review。
 * 现场摇卦与手动排盘都收敛到同一条数据链：最终只写入 rawValues 并调用同一个 buildChart。
 * 起卦时刻以"得卦"为准（六爻齐备的那一刻），确认页可人工校正；开始时刻另记 castStartedAt。
 * 会话内任何推进都会自动保存草稿，完成后清理草稿。
 */
export type SessionStep = 'question' | 'method' | 'casting' | 'review'

interface SessionState {
  caseId: string
  step: SessionStep
  method: CastMethod | null
  question: string
  category: QuestionCategory | ''
  note: string
  castAt: string
  castStartedAt: string | null
  coinThrows: CoinThrow[]
  entries: (RawYaoValue | null)[]
  overrides: ChartOverrides
}

function freshState(): SessionState {
  return {
    caseId: createId(),
    step: 'question',
    method: null,
    question: '',
    category: '',
    note: '',
    castAt: new Date().toISOString(),
    castStartedAt: null,
    coinThrows: [],
    entries: [null, null, null, null, null, null],
    overrides: {},
  }
}

/** 推进流程：首次进入时记录开始时刻，正式 castAt 留到得卦时确定 */
function beginFlow(patch: Partial<SessionState>): (previous: SessionState) => SessionState {
  return (previous) => ({
    ...previous,
    ...patch,
    castStartedAt: previous.castStartedAt ?? new Date().toISOString(),
  })
}

function rawValuesToEntries(rawValues: readonly RawYaoValue[]): (RawYaoValue | null)[] {
  const entries: (RawYaoValue | null)[] = [null, null, null, null, null, null]
  rawValues.slice(0, 6).forEach((value, index) => {
    entries[index] = value
  })
  return entries
}

interface InitialSession {
  state: SessionState
  wasRestored: boolean
}

function loadInitialSession(): InitialSession {
  const draft = draftStore.load()
  if (!draft || (draft.rawValues.length === 0 && !draft.question)) {
    return { state: freshState(), wasRestored: false }
  }
  const step: SessionStep = draft.rawValues.length === 6 ? 'review' : 'casting'
  return {
    state: {
      ...freshState(),
      caseId: draft.id,
      method: draft.method,
      question: draft.question,
      category: draft.category,
      note: draft.note,
      castAt: draft.castAt,
      // 草稿里已记录的开始时刻要保留，否则恢复后会把"恢复的那一刻"当成开始时刻
      castStartedAt: draft.castStartedAt ?? null,
      coinThrows: draft.coinThrows,
      entries: rawValuesToEntries(draft.rawValues),
      step,
    },
    wasRestored: true,
  }
}

function toDraft(state: SessionState): DivinationCase {
  const now = new Date().toISOString()
  return {
    id: state.caseId,
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    status: 'draft',
    question: state.question,
    category: state.category === '' ? 'other' : state.category,
    note: state.note,
    castAt: state.castAt,
    ...(state.castStartedAt ? { castStartedAt: state.castStartedAt } : {}),
    timeZone: CAST_TIME_ZONE,
    method: state.method ?? 'manual',
    coinThrows: state.coinThrows,
    rawValues: state.entries.filter((value): value is RawYaoValue => value !== null),
    chart: null,
    observations: [],
    prompts: [],
    answers: [],
    title: '',
    tags: [],
    verification: '',
    createdAt: now,
    updatedAt: now,
    parentCaseId: null,
  }
}

export interface CaseSession {
  step: SessionStep
  /** 本次挂载是否从 localStorage 的未完成草稿恢复而来 */
  wasRestored: boolean
  /** 最近一次自动保存草稿是否失败（存储被禁用或空间不足） */
  draftSaveFailed: boolean
  method: CastMethod | null
  question: string
  category: QuestionCategory | ''
  note: string
  castAt: string
  coinThrows: readonly CoinThrow[]
  entries: readonly (RawYaoValue | null)[]
  rawValues: readonly RawYaoValue[]
  overrides: ChartOverrides
  isComplete: boolean
  missingPositions: number[]
  setQuestion(question: string, category: QuestionCategory | '', note: string): void
  startCastFlow(): void
  startManualFlow(): void
  chooseMethod(method: CastMethod): void
  addCoinRound(faces: CoinFaces): void
  setEntry(index: number, value: RawYaoValue | null): void
  setCastAt(iso: string): void
  setOverrides(overrides: ChartOverrides): void
  undoLastYao(): void
  confirmModification(): void
  persistDraft(): void
  completeCast(): DivinationCase
  /** 清空未完成草稿并开始全新一卦：不产生正式卦例 */
  discardDraft(): void
}

export function useCaseSession(): CaseSession {
  const initial = useRef(loadInitialSession()).current
  const [state, setState] = useState<SessionState>(initial.state)
  const [wasRestored, setWasRestored] = useState(initial.wasRestored)
  const [draftSaveFailed, setDraftSaveFailed] = useState(false)

  // 草稿自动保存：空会话不保存，摇卦与录入过程中每次变化都保存
  useEffect(() => {
    if (state.step === 'question' && !state.question && !state.note) {
      return
    }
    // 草稿是尽力而为的便利功能：容器禁用 localStorage 时不能让异常冒泡，
    // 否则错误会从 effect 抛出并卸载整棵树，页面直接变空白。
    // 但失败必须让用户看见——否则会以为已经存上而直接退出。
    try {
      draftStore.save(toDraft(state))
      setDraftSaveFailed(false)
    } catch {
      setDraftSaveFailed(true)
    }
  }, [state])

  const rawValues = state.entries.filter((value): value is RawYaoValue => value !== null)
  const missingPositions = state.entries
    .map((value, index) => (value === null ? index + 1 : null))
    .filter((position): position is number => position !== null)

  const setQuestion = useCallback((question: string, category: QuestionCategory | '', note: string) => {
    setState((prev) => ({ ...prev, question, category, note }))
  }, [])

  const startCastFlow = useCallback(() => {
    setState(beginFlow({ step: 'method' }))
  }, [])

  const startManualFlow = useCallback(() => {
    setState(beginFlow({ method: 'manual', step: 'casting' }))
  }, [])

  const chooseMethod = useCallback((method: CastMethod) => {
    setState(beginFlow({ method, step: 'casting' }))
  }, [])

  const addCoinRound = useCallback((faces: CoinFaces) => {
    setState((prev) => {
      const nextIndex = prev.entries.findIndex((value) => value === null)
      if (nextIndex < 0) {
        return prev
      }
      const rawValue = facesToRawValue(faces)
      const round = (nextIndex + 1) as CoinThrow['round']
      const entries = [...prev.entries]
      entries[nextIndex] = rawValue
      const coinThrows = [...prev.coinThrows, { round, faces, rawValue }]
      const completed = entries.every((value) => value !== null)
      const step = completed ? 'review' : 'casting'
      // 六爻齐备即得卦：此刻确定起卦时间，确认页仍可人工校正
      return { ...prev, entries, coinThrows, step, ...(completed ? { castAt: new Date().toISOString() } : {}) }
    })
  }, [])

  const setEntry = useCallback((index: number, value: RawYaoValue | null) => {
    setState((prev) => {
      const entries = [...prev.entries]
      entries[index] = value
      return { ...prev, entries }
    })
  }, [])

  const setCastAt = useCallback((iso: string) => {
    setState((prev) => ({ ...prev, castAt: iso }))
  }, [])

  const setOverrides = useCallback((overrides: ChartOverrides) => {
    setState((prev) => ({ ...prev, overrides }))
  }, [])

  const undoLastYao = useCallback(() => {
    setState((prev) => {
      const entries = [...prev.entries]
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i] !== null) {
          entries[i] = null
          break
        }
      }
      return { ...prev, entries, coinThrows: prev.coinThrows.slice(0, -1), step: 'casting' }
    })
  }, [])

  const confirmModification = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'casting' }))
  }, [])

  const persistDraft = useCallback(() => {
    draftStore.save(toDraft(state))
  }, [state])

  const completeCast = useCallback((): DivinationCase => {
    const values = state.entries.filter((value): value is RawYaoValue => value !== null)
    if (values.length !== 6) {
      throw new Error('爻值不完整，不能生成正式结果')
    }
    const now = new Date().toISOString()
    const result: DivinationCase = {
      ...toDraft(state),
      status: 'cast',
      rawValues: values,
      chart: buildChart(values, state.castAt, state.overrides),
      createdAt: now,
      updatedAt: now,
    }
    draftStore.clear()
    // 本轮已经产出正式卦例，恢复标记不再成立，避免下一次进入投币页误报"已恢复"
    setWasRestored(false)
    setDraftSaveFailed(false)
    setState(freshState())
    return result
  }, [state])

  const discardDraft = useCallback(() => {
    draftStore.clear()
    setWasRestored(false)
    setDraftSaveFailed(false)
    setState(freshState())
  }, [])

  return {
    step: state.step,
    wasRestored,
    draftSaveFailed,
    method: state.method,
    question: state.question,
    category: state.category,
    note: state.note,
    castAt: state.castAt,
    coinThrows: state.coinThrows,
    entries: state.entries,
    rawValues,
    overrides: state.overrides,
    isComplete: rawValues.length === 6,
    missingPositions,
    setQuestion,
    startCastFlow,
    startManualFlow,
    chooseMethod,
    addCoinRound,
    setEntry,
    setCastAt,
    setOverrides,
    undoLastYao,
    confirmModification,
    persistDraft,
    completeCast,
    discardDraft,
  }
}
