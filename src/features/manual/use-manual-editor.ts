import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DivinationCase, HexagramChart, LinePosition, QuestionCategory, RawYaoValue } from '../../domain/types'
import type { NavigationDirection } from '../../app/navigation'
import { createDraft } from '../../domain/factories'
import { createId } from '../../domain/ids'
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
  /** 本次挂载是否从未完成的草稿恢复而来；完成一轮后的返回校正不算"未完成" */
  wasRestored: boolean
  /** 最近一次草稿保存是否失败（存储被禁用或空间不足） */
  draftSaveFailed: boolean
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

function loadedState(direction: NavigationDirection): {
  state: ManualEditorState
  openFushen: readonly LinePosition[]
  caseId: string
  completed: boolean
  wasRestored: boolean
} {
  const fresh = () => ({ state: freshState(), openFushen: [], caseId: createId(), completed: false, wasRestored: false })
  const snapshot = manualDraftStore.load()
  if (!snapshot) return fresh()
  // 已完成的一轮只在“从结果页返回上一页”时恢复，便于继续校正；
  // 从首页重新进入属于新一轮，不能把上一轮的问题与卦象带过来
  if (snapshot.completed && direction !== 'back') {
    manualDraftStore.clear()
    return fresh()
  }
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
    completed: snapshot.completed ?? false,
    // 只有“未完成的草稿”才提示恢复；已完成的一轮只是回来校正
    wasRestored: !snapshot.completed,
  }
}

function lineIndex(position: LinePosition): number {
  return position - 1
}

function snapshotFor(
  state: ManualEditorState,
  caseId: string,
  openFushen: readonly LinePosition[],
  completed: boolean,
): ManualDraftSnapshot {
  return {
    ...state,
    version: 1,
    caseId,
    openFushen,
    updatedAt: new Date().toISOString(),
    completed,
  }
}

export function useManualEditor(direction: NavigationDirection = 'forward'): ManualEditorController {
  const initial = useRef(loadedState(direction)).current
  const caseId = useRef(initial.caseId)
  const completed = useRef(initial.completed)
  const [state, setState] = useState<ManualEditorState>(initial.state)
  const [openFushen, setOpenFushen] = useState<readonly LinePosition[]>(initial.openFushen)
  const [status, setStatus] = useState<ManualEditorStatus>('idle')
  const [wasRestored, setWasRestored] = useState(initial.wasRestored)
  const [draftSaveFailed, setDraftSaveFailed] = useState(false)

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
      manualDraftStore.save(snapshotFor(state, caseId.current, openFushen, completed.current))
      setDraftSaveFailed(false)
    } catch {
      setDraftSaveFailed(true)
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
      manualDraftStore.save(snapshotFor(state, caseId.current, openFushen, completed.current))
      setDraftSaveFailed(false)
      setStatus('saved')
    } catch {
      setDraftSaveFailed(true)
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
    // 标记这一轮已完结：草稿仍留着供“从结果页返回”继续校正，但不再带进下一次全新录入
    completed.current = true
    setWasRestored(false)
    try {
      manualDraftStore.save(snapshotFor(state, caseId.current, openFushen, true))
    } catch {
      // 草稿写不进去不影响已生成的正式卦例
    }
    return {
      ...draft,
      status: 'cast',
      engineVersion: ENGINE_VERSION,
      rawValues: [...state.rawValues],
      chart,
      createdAt: now,
      updatedAt: now,
    }
  }, [chart, openFushen, state])

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
    caseId.current = createId()
    completed.current = false
    setWasRestored(false)
    setDraftSaveFailed(false)
    setState(freshState())
    setOpenFushen([])
    setStatus('idle')
  }, [])

  return {
    state,
    chart,
    issues,
    status,
    wasRestored,
    draftSaveFailed,
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
