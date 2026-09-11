export type YinYang = 'yin' | 'yang'
export type RawYaoValue = 6 | 7 | 8 | 9
export type LinePosition = 1 | 2 | 3 | 4 | 5 | 6
export type QuestionCategory =
  | 'career'
  | 'wealth'
  | 'relationship'
  | 'study'
  | 'health'
  | 'dispute'
  | 'travel'
  | 'lost-item'
  | 'other'

export type CastMethod = 'simulated-coins' | 'physical-coins' | 'manual'
export type CaseStatus = 'draft' | 'cast' | 'prompted' | 'answered' | 'verified'
export type PromptVariant = 'concise' | 'professional'
export type InterpretationTendency =
  | 'supportive'
  | 'resistant'
  | 'mixed'
  | 'neutral'

export interface CoinThrow {
  round: LinePosition
  faces: readonly [0 | 1, 0 | 1, 0 | 1]
  rawValue: RawYaoValue
}

export interface Fushen {
  liuqin: string
  zhi: string
}

/** 允许专业编辑人工覆盖的爻级字段 */
export type OverrideField = 'gan' | 'zhi' | 'liuqin' | 'liushen' | 'shiYing' | 'xunKong' | 'fushen'

export interface YaoLine {
  position: LinePosition
  rawValue: RawYaoValue
  type: YinYang
  changing: boolean
  gan: string
  zhi: string
  wuxing: string
  liuqin: string
  liushen: string
  shiYing: 'shi' | 'ying' | null
  xunKong: boolean
  fushen: Fushen | null
  /** 已被人工覆盖的字段；缺省视为全部由引擎计算 */
  overriddenFields?: readonly OverrideField[]
}

export interface HexagramFigure {
  name: string
  upperTrigram: string
  lowerTrigram: string
  palace: string
  palaceElement: string
  lines: YaoLine[]
}

export interface Sizhu {
  year: string
  month: string
  day: string
  hour: string
}

/**
 * 排盘采用的时区。一次排盘的全部日历字段（年月日时）都在该时区内解释，
 * 结果与设备/容器的本地时区无关。
 */
export interface CastTimeZone {
  id: string
  label: string
  offsetMinutes: number
  /** 由 v1 记录迁移而来、原记录未保存时区时为 true */
  assumed?: boolean
}

/** 某个时区内的日历字段 */
export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export interface HexagramChart {
  original: HexagramFigure
  changed: HexagramFigure | null
  changingLines: LinePosition[]
  allChanging: boolean
  sizhu: Sizhu
  xunKong: readonly [string, string]
}

export interface InterpretationObservation {
  ruleId: string
  observation: string
  basis: string
  tendency: InterpretationTendency
  linePositions: LinePosition[]
}

export interface PromptSnapshot {
  id: string
  variant: PromptVariant
  version: string
  content: string
  createdAt: string
}

export interface AiAnswer {
  id: string
  source: string
  promptId: string
  content: string
  createdAt: string
}

export interface DivinationCase {
  id: string
  schemaVersion: number
  engineVersion: string
  status: CaseStatus
  question: string
  category: QuestionCategory
  note: string
  castAt: string
  /** 起卦开始时刻，仅作记录，不参与排盘 */
  castStartedAt?: string
  /** 排盘时区：起卦时间与四柱都按它解释（v2 起必填，迁移记录为 assumed） */
  timeZone?: CastTimeZone
  method: CastMethod
  coinThrows: CoinThrow[]
  rawValues: RawYaoValue[]
  chart: HexagramChart | null
  observations: InterpretationObservation[]
  prompts: PromptSnapshot[]
  answers: AiAnswer[]
  title: string
  tags: string[]
  verification: string
  createdAt: string
  updatedAt: string
  parentCaseId: string | null
}

export interface ValidationIssue {
  path: string
  message: string
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; issues: ValidationIssue[] }
