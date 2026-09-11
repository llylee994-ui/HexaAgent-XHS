import { useCallback, useEffect, useState } from 'react'
import type { CastMethod, CoinThrow, DivinationCase, QuestionCategory, RawYaoValue } from '../domain/types'
import { ENGINE_VERSION, SCHEMA_VERSION } from '../domain/versions'
import { CAST_TIME_ZONE } from '../domain/time-zone'
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
    caseId: crypto.randomUUID(),
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

function restoreState(): SessionState {
  const draft = draftStore.load()
  if (!draft || (draft.rawValues.length === 0 && !draft.question)) {
    return freshState()
  }
  return {
    ...freshState(),
    caseId: draft.id,
    method: draft.method,
    question: draft.question,
    category: draft.category,
    note: draft.note,
    castAt: draft.castAt,
    castStartedAt: null,
    coinThrows: draft.coinThrows,
    entries: rawValuesToEntries(draft.rawValues),
    step: 'casting',
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
}

export function useCaseSession(): CaseSession {
  const [state, setState] = useState<SessionState>(restoreState)

  // 草稿自动保存：空会话不保存，摇卦与录入过程中每次变化都保存
  useEffect(() => {
    if (state.step === 'question' && !state.question && !state.note) {
      return
    }
    draftStore.save(toDraft(state))
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
    setState(freshState())
    return result
  }, [state])

  return {
    step: state.step,
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
  }
}
