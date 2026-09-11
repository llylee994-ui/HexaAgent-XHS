import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DivinationCase, HexagramChart, LinePosition, QuestionCategory, RawYaoValue } from '../../domain/types'
import { createDraft } from '../../domain/factories'
import type { ChartLineOverrides } from '../../engines/najia/chart'
import { ENGINE_VERSION } from '../../domain/versions'
import {
  buildManualChart,
  clearLineOverride,
  clearTimeDependentOverrides,
  lineFromRawValue,
  rawValueFromLine,
  rawValuesForHexagram,
  type ManualEditorState,
  type ManualLineInput,
  type ManualValidationIssue,
  validateManualState,
} from './model'
import { manualDraftStore, type ManualDraftSnapshot } from './manual-draft-store'

export type ManualEditorStatus = 'idle' | 'auto-filled' | 'corrected' | 'time-updated' | 'saved' | 'error'

export interface ManualEditorController {
  state: ManualEditorState
  chart: HexagramChart | null
  issues: readonly ManualValidationIssue[]
  status: ManualEditorStatus
  selectHexagram(name: string): void
  setLine(position: LinePosition, patch: Partial<ManualLineInput>): void
  setLineOverride(position: LinePosition, patch: ChartLineOverrides): void
  restoreLine(position: LinePosition): void
  restoreAll(): void
  saveDraft(): void
  complete(): DivinationCase | null
  setQuestion(question: string, category: QuestionCategory | '', note: string): void
  setCastAt(iso: string): void
  setSizhu(sizhu: { year: string; month: string; day: string; hour: string }): void
  useCalculatedSizhu(): void
  toggleFushen(position: LinePosition): void
  openFushen: readonly LinePosition[]
  discardDraft(): void
}

const DEFAULT_RAW_VALUES: readonly RawYaoValue[] = [8, 8, 8, 8, 8, 8]

function freshState(): ManualEditorState {
  return {
    question: '',
    category: '',
    note: '',
    castAt: new Date().toISOString(),
    rawValues: DEFAULT_RAW_VALUES,
    overrides: {},
    selectedHexagramName: '',
  }
}

function loadedState(): { state: ManualEditorState; openFushen: readonly LinePosition[]; caseId: string } {
  const snapshot = manualDraftStore.load()
  if (!snapshot) return { state: freshState(), openFushen: [], caseId: crypto.randomUUID() }
  return {
    state: {
      question: snapshot.question,
      category: snapshot.category,
      note: snapshot.note,
      castAt: snapshot.castAt,
      rawValues: snapshot.rawValues,
      overrides: snapshot.overrides,
      selectedHexagramName: snapshot.selectedHexagramName,
    },
    openFushen: snapshot.openFushen,
    caseId: snapshot.caseId,
  }
}

function lineIndex(position: LinePosition): number {
  return position - 1
}

function snapshotFor(state: ManualEditorState, caseId: string, openFushen: readonly LinePosition[]): ManualDraftSnapshot {
  return {
    ...state,
    version: 1,
    caseId,
    openFushen,
    updatedAt: new Date().toISOString(),
  }
}

export function useManualEditor(): ManualEditorController {
  const initial = useRef(loadedState()).current
  const caseId = useRef(initial.caseId)
  const [state, setState] = useState<ManualEditorState>(initial.state)
  const [openFushen, setOpenFushen] = useState<readonly LinePosition[]>(initial.openFushen)
  const [status, setStatus] = useState<ManualEditorStatus>('idle')

  const chart = useMemo(() => {
    try {
      return buildManualChart(state)
    } catch {
      return null
    }
  }, [state])

  const issues = useMemo(() => validateManualState(state), [state])

  useEffect(() => {
    if (!state.question.trim() || state.rawValues.length !== 6) return
    try {
      manualDraftStore.save(snapshotFor(state, caseId.current, openFushen))
    } catch {
      setStatus('error')
    }
  }, [openFushen, state])

  const selectHexagram = useCallback((name: string) => {
    setState((previous) => ({ ...previous, selectedHexagramName: name, rawValues: rawValuesForHexagram(name) }))
    setStatus('auto-filled')
  }, [])

  const setLine = useCallback((position: LinePosition, patch: Partial<ManualLineInput>) => {
    setState((previous) => {
      const current = lineFromRawValue(previous.rawValues[lineIndex(position)] ?? 8)
      const next = { ...current, ...patch }
      const rawValues = [...previous.rawValues]
      rawValues[lineIndex(position)] = rawValueFromLine(next.type, next.changing)
      return { ...previous, rawValues }
    })
    setStatus('corrected')
  }, [])

  const setLineOverride = useCallback((position: LinePosition, patch: ChartLineOverrides) => {
    setState((previous) => ({
      ...previous,
      overrides: {
        ...previous.overrides,
        lines: {
          ...(previous.overrides.lines ?? {}),
          [position]: { ...(previous.overrides.lines?.[position] ?? {}), ...patch },
        },
      },
    }))
    setStatus('corrected')
  }, [])

  const restoreLine = useCallback((position: LinePosition) => {
    setState((previous) => ({ ...previous, overrides: clearLineOverride(previous.overrides, position) }))
    setStatus('auto-filled')
  }, [])

  const restoreAll = useCallback(() => {
    setState((previous) => ({ ...previous, overrides: {} }))
    setStatus('auto-filled')
  }, [])

  const saveDraft = useCallback(() => {
    if (state.rawValues.length !== 6) {
      setStatus('error')
      return
    }
    try {
      manualDraftStore.save(snapshotFor(state, caseId.current, openFushen))
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }, [openFushen, state])

  const complete = useCallback((): DivinationCase | null => {
    const currentIssues = validateManualState(state)
    if (currentIssues.length > 0 || !chart) {
      setStatus('error')
      return null
    }
    const category = state.category === '' ? 'other' : state.category
    const draft = createDraft({ question: state.question, category, castAt: state.castAt, method: 'manual', note: state.note })
    const now = new Date().toISOString()
    return {
      ...draft,
      status: 'cast',
      engineVersion: ENGINE_VERSION,
      rawValues: [...state.rawValues],
      chart,
      createdAt: now,
      updatedAt: now,
    }
  }, [chart, state])

  const setQuestion = useCallback((question: string, category: QuestionCategory | '', note: string) => {
    setState((previous) => ({ ...previous, question, category, note }))
  }, [])

  const setCastAt = useCallback((castAt: string) => {
    // 时间变了，受时间影响的覆盖（四柱、爻级旬空）必须一起失效，否则提示词里的时间与四柱会互相矛盾
    setState((previous) => ({ ...previous, castAt, overrides: clearTimeDependentOverrides(previous.overrides) }))
    setStatus('time-updated')
  }, [])

  const setSizhu = useCallback((sizhu: { year: string; month: string; day: string; hour: string }) => {
    setState((previous) => ({ ...previous, overrides: { ...previous.overrides, sizhu } }))
    setStatus('corrected')
  }, [])

  const useCalculatedSizhu = useCallback(() => {
    setState((previous) => {
      const overrides = { ...previous.overrides }
      delete overrides.sizhu
      return { ...previous, overrides }
    })
    setStatus('auto-filled')
  }, [])

  const toggleFushen = useCallback((position: LinePosition) => {
    setOpenFushen((previous) => previous.includes(position) ? previous.filter((item) => item !== position) : [...previous, position])
  }, [])

  const discardDraft = useCallback(() => {
    manualDraftStore.clear()
    caseId.current = crypto.randomUUID()
    setState(freshState())
    setOpenFushen([])
    setStatus('idle')
  }, [])

  return {
    state,
    chart,
    issues,
    status,
    selectHexagram,
    setLine,
    setLineOverride,
    restoreLine,
    restoreAll,
    saveDraft,
    complete,
    setQuestion,
    setCastAt,
    setSizhu,
    useCalculatedSizhu,
    toggleFushen,
    openFushen,
    discardDraft,
  }
}
