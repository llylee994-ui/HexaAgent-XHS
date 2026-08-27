import type {
  CaseStatus,
  CastMethod,
  QuestionCategory,
  ValidationIssue,
  ValidationResult,
} from './types'
import { SCHEMA_VERSION } from './versions'

const RAW_VALUES = new Set([6, 7, 8, 9])
const CATEGORIES = new Set<QuestionCategory>([
  'career',
  'wealth',
  'relationship',
  'study',
  'health',
  'dispute',
  'travel',
  'lost-item',
  'other',
])
const METHODS = new Set<CastMethod>([
  'simulated-coins',
  'physical-coins',
  'manual',
])
const STATUSES = new Set<CaseStatus>([
  'draft',
  'cast',
  'prompted',
  'answered',
  'verified',
])
const FORMAL_STATUSES = new Set<CaseStatus>([
  'cast',
  'prompted',
  'answered',
  'verified',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parsed = new Date(value)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value
}

function addIssue(
  issues: ValidationIssue[],
  path: string,
  message: string,
) {
  issues.push({ path, message })
}

function validateString(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
) {
  if (typeof value !== 'string') {
    addIssue(issues, path, '必须是字符串')
  }
}

function validateTimestamp(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
) {
  if (!isIsoInstant(value)) {
    addIssue(issues, path, '必须是包含时区的完整 ISO 时间')
  }
}

function validateRawValues(
  value: unknown,
  status: unknown,
  issues: ValidationIssue[],
) {
  if (!Array.isArray(value)) {
    addIssue(issues, 'rawValues', '必须是爻值数组')
    return
  }

  const isFormal = typeof status === 'string' && FORMAL_STATUSES.has(status as CaseStatus)
  if ((isFormal && value.length !== 6) || (!isFormal && value.length > 6)) {
    addIssue(
      issues,
      'rawValues',
      isFormal ? '正式结果必须恰好包含六个爻值' : '草稿最多包含六个爻值',
    )
  }

  value.forEach((rawValue, index) => {
    if (!RAW_VALUES.has(rawValue)) {
      addIssue(issues, `rawValues[${index}]`, '爻值只能是 6、7、8 或 9')
    }
  })
}

function validateAnswerLinks(
  prompts: unknown,
  answers: unknown,
  issues: ValidationIssue[],
) {
  if (!Array.isArray(prompts)) {
    addIssue(issues, 'prompts', '必须是提示词快照数组')
    return
  }
  if (!Array.isArray(answers)) {
    addIssue(issues, 'answers', '必须是 AI 回答数组')
    return
  }

  const promptIds = new Set(
    prompts
      .filter(isRecord)
      .map((prompt) => prompt.id)
      .filter((id): id is string => typeof id === 'string'),
  )

  answers.forEach((answer, index) => {
    if (!isRecord(answer)) {
      addIssue(issues, `answers[${index}]`, '回答必须是对象')
      return
    }
    if (typeof answer.promptId !== 'string' || !promptIds.has(answer.promptId)) {
      addIssue(
        issues,
        `answers[${index}].promptId`,
        '回答必须关联当前卦例中的提示词快照',
      )
    }
    validateTimestamp(answer.createdAt, `answers[${index}].createdAt`, issues)
  })
}

export function validateCase(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = []

  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [{ path: '', message: '卦例必须是对象' }],
    }
  }

  if (value.schemaVersion !== SCHEMA_VERSION) {
    addIssue(issues, 'schemaVersion', '数据版本不受当前引擎支持')
  }
  validateString(value.engineVersion, 'engineVersion', issues)
  validateString(value.id, 'id', issues)
  validateString(value.question, 'question', issues)
  validateString(value.note, 'note', issues)
  validateString(value.title, 'title', issues)
  validateString(value.verification, 'verification', issues)

  if (typeof value.status !== 'string' || !STATUSES.has(value.status as CaseStatus)) {
    addIssue(issues, 'status', '状态无效')
  }
  if (
    typeof value.category !== 'string' ||
    !CATEGORIES.has(value.category as QuestionCategory)
  ) {
    addIssue(issues, 'category', '问题类别无效')
  }
  if (typeof value.method !== 'string' || !METHODS.has(value.method as CastMethod)) {
    addIssue(issues, 'method', '起卦方式无效')
  }

  validateTimestamp(value.castAt, 'castAt', issues)
  validateTimestamp(value.createdAt, 'createdAt', issues)
  validateTimestamp(value.updatedAt, 'updatedAt', issues)
  validateRawValues(value.rawValues, value.status, issues)
  validateAnswerLinks(value.prompts, value.answers, issues)

  if (!Array.isArray(value.coinThrows)) {
    addIssue(issues, 'coinThrows', '必须是投币记录数组')
  }
  if (!Array.isArray(value.observations)) {
    addIssue(issues, 'observations', '必须是规则观察数组')
  }
  if (!Array.isArray(value.tags)) {
    addIssue(issues, 'tags', '必须是标签数组')
  }

  const isFormal =
    typeof value.status === 'string' && FORMAL_STATUSES.has(value.status as CaseStatus)
  if (isFormal && !isRecord(value.chart)) {
    addIssue(issues, 'chart', '正式结果必须包含完整排盘')
  }

  const copiedDraft = value.status === 'draft' && isRecord(value.chart)
  if (
    copiedDraft &&
    (typeof value.parentCaseId !== 'string' || value.parentCaseId.length === 0)
  ) {
    addIssue(issues, 'parentCaseId', '修改已有卦象必须关联原卦例')
  } else if (
    value.parentCaseId !== null &&
    typeof value.parentCaseId !== 'string'
  ) {
    addIssue(issues, 'parentCaseId', '必须是原卦例 ID 或 null')
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues }
}
