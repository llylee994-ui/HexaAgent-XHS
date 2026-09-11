import type {
  CastMethod,
  DivinationCase,
  QuestionCategory,
} from './types'
import { ENGINE_VERSION, SCHEMA_VERSION } from './versions'
import { CAST_TIME_ZONE } from './time-zone'

export interface CreateDraftInput {
  question: string
  category: QuestionCategory
  castAt: string
  method: CastMethod
  note?: string
  castStartedAt?: string
  parentCaseId?: string | null
}

function createCaseId() {
  return globalThis.crypto.randomUUID()
}

export function createDraft(input: CreateDraftInput): DivinationCase {
  const now = new Date().toISOString()

  return {
    id: createCaseId(),
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    status: 'draft',
    question: input.question,
    category: input.category,
    note: input.note ?? '',
    castAt: input.castAt,
    ...(input.castStartedAt ? { castStartedAt: input.castStartedAt } : {}),
    timeZone: CAST_TIME_ZONE,
    method: input.method,
    coinThrows: [],
    rawValues: [],
    chart: null,
    observations: [],
    prompts: [],
    answers: [],
    title: '',
    tags: [],
    verification: '',
    createdAt: now,
    updatedAt: now,
    parentCaseId: input.parentCaseId ?? null,
  }
}
