import type {
  ChartOverrides,
  ChartLineOverrides,
} from '../../engines/najia/chart'
import { buildChart } from '../../engines/najia/chart'
import type {
  HexagramChart,
  LinePosition,
  QuestionCategory,
  RawYaoValue,
  YinYang,
} from '../../domain/types'
import { rawValuesForHexagram as catalogRawValues, searchHexagrams } from './catalog'

export interface ManualLineInput {
  position: LinePosition
  type: YinYang
  changing: boolean
}

export interface ManualEditorState {
  question: string
  category: QuestionCategory | ''
  note: string
  castAt: string
  rawValues: readonly RawYaoValue[]
  overrides: ChartOverrides
  selectedHexagramName: string
}

export interface ManualValidationIssue {
  section: 'question' | 'sizhu' | 'lines'
  position?: LinePosition
  field?: string
  message: string
}

export function rawValueFromLine(type: YinYang, changing: boolean): RawYaoValue {
  if (type === 'yin') return changing ? 6 : 8
  return changing ? 9 : 7
}

export function lineFromRawValue(value: RawYaoValue): Pick<ManualLineInput, 'type' | 'changing'> {
  if (value === 6) return { type: 'yin', changing: true }
  if (value === 7) return { type: 'yang', changing: false }
  if (value === 8) return { type: 'yin', changing: false }
  return { type: 'yang', changing: true }
}

export { searchHexagrams }

export function rawValuesForHexagram(name: string): readonly RawYaoValue[] {
  return catalogRawValues(name)
}

export function buildManualChart(state: ManualEditorState): HexagramChart {
  const castAt = new Date(state.castAt)
  if (Number.isNaN(castAt.getTime())) throw new Error('起卦时间无效')
  return buildChart(state.rawValues, castAt, state.overrides)
}

function issue(section: ManualValidationIssue['section'], message: string, field?: string, position?: LinePosition): ManualValidationIssue {
  return { section, message, ...(field ? { field } : {}), ...(position ? { position } : {}) }
}

export function validateManualState(state: ManualEditorState): readonly ManualValidationIssue[] {
  const issues: ManualValidationIssue[] = []
  if (!state.question.trim()) issues.push(issue('question', '请先填写问题', 'question'))

  let chart: HexagramChart
  try {
    chart = buildManualChart(state)
  } catch (error) {
    issues.push(issue('sizhu', error instanceof Error ? error.message : '排盘失败'))
    return issues
  }

  for (const [field, value] of Object.entries(chart.sizhu)) {
    if (!value?.trim()) issues.push(issue('sizhu', `请补充${field}柱`, field))
  }

  const lines = chart.original.lines
  if (lines.length !== 6) {
    issues.push(issue('lines', '六爻必须完整', 'lines'))
    return issues
  }
  for (const line of lines) {
    if (!line.zhi) issues.push(issue('lines', '地支不能为空', 'zhi', line.position))
    if (!line.liuqin) issues.push(issue('lines', '六亲不能为空', 'liuqin', line.position))
    if (!line.liushen) issues.push(issue('lines', '六神不能为空', 'liushen', line.position))
    if (line.fushen && (!line.fushen.liuqin || !line.fushen.zhi)) {
      issues.push(issue('lines', '伏神六亲和地支必须同时完整', 'fushen', line.position))
    }
  }

  const shi = lines.filter((line) => line.shiYing === 'shi')
  const ying = lines.filter((line) => line.shiYing === 'ying')
  if (shi.length !== 1 || ying.length !== 1 || shi[0]?.position === ying[0]?.position) {
    issues.push(issue('lines', '世爻和应爻必须各一个且不能在同一爻', 'shiYing'))
  }
  return issues
}

export function clearLineOverride(overrides: ChartOverrides, position: LinePosition): ChartOverrides {
  const lines = { ...(overrides.lines ?? {}) }
  delete lines[position]
  return { ...overrides, lines }
}

export type { ChartLineOverrides, ChartOverrides }
