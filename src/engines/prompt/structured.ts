import type { DivinationCase, Fushen, LinePosition, OverrideField, Sizhu, YaoLine } from '../../domain/types'
import { PROMPT_VERSION } from '../../domain/versions'
import { formatMethod } from './formatter'

export interface StructuredPromptLine {
  position: LinePosition
  type: YaoLine['type']
  changing: boolean
  gan: string
  zhi: string
  wuxing: string
  liuqin: string
  liushen: string
  shiYing: 'shi' | 'ying' | null
  xunKong: boolean
  fushen: Fushen | null
  overriddenFields: readonly OverrideField[]
}

export interface StructuredPromptData {
  schemaVersion: number
  engineVersion: string
  promptVersion: string
  question: string
  category: string
  note: string
  castAt: string
  method: string
  sizhu: Sizhu
  yueJian: string
  riChen: string
  xunKong: readonly [string, string]
  original: { name: string; palace: string; palaceElement: string; lines: StructuredPromptLine[] }
  changed: null | { name: string; lines: StructuredPromptLine[] }
  changingLines: readonly LinePosition[]
}

function toStructuredLine(line: YaoLine): StructuredPromptLine {
  return {
    position: line.position,
    type: line.type,
    changing: line.changing,
    gan: line.gan,
    zhi: line.zhi,
    wuxing: line.wuxing,
    liuqin: line.liuqin,
    liushen: line.liushen,
    shiYing: line.shiYing,
    xunKong: line.xunKong,
    fushen: line.fushen ? { ...line.fushen } : null,
    overriddenFields: [...(line.overriddenFields ?? [])],
  }
}

function toStructuredFigure(figure: NonNullable<DivinationCase['chart']>['original'] | NonNullable<DivinationCase['chart']>['changed']) {
  if (!figure) return null
  return {
    name: figure.name,
    palace: figure.palace,
    palaceElement: figure.palaceElement,
    lines: [...figure.lines].sort((a, b) => b.position - a.position).map(toStructuredLine),
  }
}

export function buildStructuredPromptData(caseValue: DivinationCase): StructuredPromptData {
  const chart = caseValue.chart
  if (!chart) {
    return {
      schemaVersion: caseValue.schemaVersion,
      engineVersion: caseValue.engineVersion,
      promptVersion: PROMPT_VERSION,
      question: caseValue.question,
      category: caseValue.category,
      note: caseValue.note,
      castAt: caseValue.castAt,
      method: formatMethod(caseValue.method),
      sizhu: { year: '', month: '', day: '', hour: '' },
      yueJian: '',
      riChen: '',
      xunKong: ['', ''],
      original: { name: '', palace: '', palaceElement: '', lines: [] },
      changed: null,
      changingLines: [],
    }
  }

  return {
    schemaVersion: caseValue.schemaVersion,
    engineVersion: caseValue.engineVersion,
    promptVersion: PROMPT_VERSION,
    question: caseValue.question,
    category: caseValue.category,
    note: caseValue.note,
    castAt: caseValue.castAt,
    method: formatMethod(caseValue.method),
    sizhu: { ...chart.sizhu },
    yueJian: chart.sizhu.month[1] ?? '',
    riChen: chart.sizhu.day[1] ?? '',
    xunKong: [...chart.xunKong] as [string, string],
    original: toStructuredFigure(chart.original)!,
    changed: toStructuredFigure(chart.changed),
    changingLines: [...chart.changingLines],
  }
}
