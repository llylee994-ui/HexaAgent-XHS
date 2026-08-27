import { describe, expect, it } from 'vitest'
import { createDraft } from '../../src/domain/factories'
import type { DivinationCase, HexagramChart } from '../../src/domain/types'
import { validateCase } from '../../src/domain/validation'
import {
  ENGINE_VERSION,
  PROMPT_VERSION,
  SCHEMA_VERSION,
} from '../../src/domain/versions'

const castAt = '2026-08-27T08:00:00.000Z'

function issuePaths(result: ReturnType<typeof validateCase>) {
  return result.ok ? [] : result.issues.map(({ path }) => path)
}

function placeholderChart(): HexagramChart {
  return {
    original: {
      name: '乾为天',
      upperTrigram: '乾',
      lowerTrigram: '乾',
      palace: '乾',
      palaceElement: '金',
      lines: [],
    },
    changed: null,
    changingLines: [],
    allChanging: false,
    sizhu: {
      year: '丙午',
      month: '丙申',
      day: '癸酉',
      hour: '庚申',
    },
    xunKong: ['戌', '亥'],
  }
}

describe('createDraft', () => {
  it('creates an empty versioned draft with independent collections', () => {
    const first = createDraft({
      question: '这次面试是否适合继续推进？',
      category: 'career',
      castAt,
      method: 'manual',
    })
    const second = createDraft({
      question: '第二条问题',
      category: 'other',
      castAt,
      method: 'physical-coins',
    })

    expect(first).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      engineVersion: ENGINE_VERSION,
      status: 'draft',
      question: '这次面试是否适合继续推进？',
      category: 'career',
      note: '',
      castAt,
      method: 'manual',
      coinThrows: [],
      rawValues: [],
      chart: null,
      observations: [],
      prompts: [],
      answers: [],
      title: '',
      tags: [],
      verification: '',
      parentCaseId: null,
    })
    expect(first.id).not.toBe(second.id)
    expect(new Date(first.createdAt).toISOString()).toBe(first.createdAt)
    expect(first.updatedAt).toBe(first.createdAt)

    first.tags.push('面试')
    expect(second.tags).toEqual([])
  })

  it('records optional notes and a parent case for a copied draft', () => {
    const draft = createDraft({
      question: '修改后的问题',
      category: 'study',
      castAt,
      method: 'manual',
      note: '保留原卦',
      parentCaseId: 'case-original',
    })

    expect(draft.note).toBe('保留原卦')
    expect(draft.parentCaseId).toBe('case-original')
  })
})

describe('validateCase', () => {
  it('accepts a well-formed incomplete draft', () => {
    const draft = createDraft({
      question: '测试草稿',
      category: 'other',
      castAt,
      method: 'manual',
    })
    draft.rawValues = [7, 8, 9]

    expect(validateCase(draft)).toEqual({ ok: true })
  })

  it('reports invalid raw values and more than six lines', () => {
    const draft = createDraft({
      question: '测试输入',
      category: 'other',
      castAt,
      method: 'manual',
    }) as unknown as DivinationCase
    draft.rawValues = [6, 5, 7, 8, 9, 6, 7] as DivinationCase['rawValues']

    const result = validateCase(draft)

    expect(issuePaths(result)).toEqual(
      expect.arrayContaining(['rawValues', 'rawValues[1]']),
    )
  })

  it('requires exactly six raw values and a chart for formal results', () => {
    const castCase = createDraft({
      question: '正式排盘',
      category: 'wealth',
      castAt,
      method: 'manual',
    })
    castCase.status = 'cast'
    castCase.rawValues = [7, 7, 7]

    const result = validateCase(castCase)

    expect(issuePaths(result)).toEqual(
      expect.arrayContaining(['rawValues', 'chart']),
    )
  })

  it('reports timestamps that are not complete ISO instants', () => {
    const draft = createDraft({
      question: '时间校验',
      category: 'other',
      castAt,
      method: 'manual',
    })
    draft.castAt = '2026-08-27 16:00'
    draft.updatedAt = 'not-a-date'

    const result = validateCase(draft)

    expect(issuePaths(result)).toEqual(
      expect.arrayContaining(['castAt', 'updatedAt']),
    )
  })

  it('requires every answer to reference a prompt in the same case', () => {
    const draft = createDraft({
      question: '回答关联',
      category: 'other',
      castAt,
      method: 'manual',
    })
    draft.answers.push({
      id: 'answer-1',
      source: 'ChatGPT',
      promptId: 'missing-prompt',
      content: '回答内容',
      createdAt: castAt,
    })

    expect(issuePaths(validateCase(draft))).toContain('answers[0].promptId')
  })

  it('requires a parent id when a draft carries a completed chart', () => {
    const copiedDraft = createDraft({
      question: '修改已有卦象',
      category: 'relationship',
      castAt,
      method: 'manual',
    })
    copiedDraft.rawValues = [7, 7, 7, 7, 7, 7]
    copiedDraft.chart = placeholderChart()

    expect(issuePaths(validateCase(copiedDraft))).toContain('parentCaseId')
  })

  it('accepts a complete copied draft with linked prompts and answers', () => {
    const copiedDraft = createDraft({
      question: '修改已有卦象',
      category: 'relationship',
      castAt,
      method: 'manual',
      parentCaseId: 'case-original',
    })
    copiedDraft.rawValues = [7, 7, 7, 7, 7, 7]
    copiedDraft.chart = placeholderChart()
    copiedDraft.prompts.push({
      id: 'prompt-1',
      variant: 'concise',
      version: PROMPT_VERSION,
      content: '提示词',
      createdAt: castAt,
    })
    copiedDraft.answers.push({
      id: 'answer-1',
      source: 'ChatGPT',
      promptId: 'prompt-1',
      content: '回答内容',
      createdAt: castAt,
    })

    expect(validateCase(copiedDraft)).toEqual({ ok: true })
  })
})
