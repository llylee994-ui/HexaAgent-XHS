import type { DivinationCase, Fushen, LinePosition, OverrideField, Sizhu, YaoLine } from '../../domain/types'
import { PROMPT_VERSION } from '../../domain/versions'
import { CAST_TIME_ZONE } from '../../domain/time-zone'
import { isSizhuOverridden } from '../najia/chart'
import { formatZonedDateTime } from '../calendar/zoned-time'
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

/** 排盘规则：外部 AI 复核四柱时必须知道的口径 */
export interface StructuredPromptRules {
  solarTermSource: string
  ziHourRule: 'no-day-rollover'
  trueSolarTime: boolean
}

export interface StructuredPromptData {
  schemaVersion: number
  engineVersion: string
  promptVersion: string
  question: string
  category: string
  note: string
  /** 起卦绝对时刻（机器可读，UTC） */
  castAt: string
  /** 同一时刻在排盘时区的墙上时间 */
  castAtLocal: string
  timeZone: { id: string; label: string; offsetMinutes: number }
  rules: StructuredPromptRules
  method: string
  sizhu: Sizhu
  /** 四柱是否经过人工校正（真实值不同于按起卦时间自动推算的结果） */
  sizhuOverridden: boolean
  yueJian: string
  riChen: string
  xunKong: readonly [string, string]
  original: { name: string; palace: string; palaceElement: string; lines: StructuredPromptLine[] }
  changed: null | { name: string; lines: StructuredPromptLine[] }
  changingLines: readonly LinePosition[]
}

const RULES: StructuredPromptRules = {
  solarTermSource: '香港天文台公布的二十四节气交节时刻（香港时间 = UTC+8，分钟级）',
  ziHourRule: 'no-day-rollover',
  trueSolarTime: false,
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

/** 时间与时区相关的公共字段：绝对时刻与本地时刻同源，避免两者各自漂移 */
function timeFields(caseValue: DivinationCase) {
  const zone = caseValue.timeZone ?? CAST_TIME_ZONE
  return {
    castAt: caseValue.castAt,
    castAtLocal: formatZonedDateTime(caseValue.castAt, zone.offsetMinutes),
    timeZone: { id: zone.id, label: zone.label, offsetMinutes: zone.offsetMinutes },
    rules: { ...RULES },
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
      ...timeFields(caseValue),
      method: formatMethod(caseValue.method),
      sizhu: { year: '', month: '', day: '', hour: '' },
      sizhuOverridden: false,
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
    ...timeFields(caseValue),
    method: formatMethod(caseValue.method),
    sizhu: { ...chart.sizhu },
    sizhuOverridden: isSizhuOverridden(caseValue.castAt, chart, caseValue.timeZone),
    yueJian: chart.sizhu.month[1] ?? '',
    riChen: chart.sizhu.day[1] ?? '',
    xunKong: [...chart.xunKong] as [string, string],
    original: toStructuredFigure(chart.original)!,
    changed: toStructuredFigure(chart.changed),
    changingLines: [...chart.changingLines],
  }
}
