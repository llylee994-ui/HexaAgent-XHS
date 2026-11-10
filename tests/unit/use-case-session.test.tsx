import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCaseSession } from '../../src/app/use-case-session'
import { createDraft } from '../../src/domain/factories'
import { draftStore } from '../../src/storage/draft-store'

function seedDraft() {
  const draft = createDraft({
    question: '恢复中的问题',
    category: 'career',
    castAt: '2026-11-10T07:00:00.000Z',
    method: 'simulated-coins',
  })
  draftStore.save({
    ...draft,
    rawValues: [9, 9],
    coinThrows: [
      { round: 1, faces: [1, 1, 1], rawValue: 9 },
      { round: 2, faces: [1, 1, 1], rawValue: 9 },
    ],
  })
  return draft
}

beforeEach(() => localStorage.clear())

describe('现场摇卦会话的草稿恢复与清空', () => {
  it('没有草稿时 wasRestored 为 false', () => {
    const { result } = renderHook(() => useCaseSession())
    expect(result.current.wasRestored).toBe(false)
    expect(result.current.step).toBe('question')
  })

  it('从有效草稿恢复时暴露 wasRestored 与原始问题', () => {
    seedDraft()
    const { result } = renderHook(() => useCaseSession())

    expect(result.current.wasRestored).toBe(true)
    expect(result.current.question).toBe('恢复中的问题')
    expect(result.current.step).toBe('casting')
    expect(result.current.rawValues).toEqual([9, 9])
  })

  it('discardDraft 清空草稿、换新 case ID 并回到全新问题页', () => {
    const draft = seedDraft()
    const { result } = renderHook(() => useCaseSession())

    act(() => result.current.discardDraft())

    expect(result.current.wasRestored).toBe(false)
    expect(result.current.step).toBe('question')
    expect(result.current.question).toBe('')
    expect(result.current.rawValues).toEqual([])
    expect(draftStore.load()).toBeNull()

    // 清空后重新填写会以新的 case ID 落草稿，不会复用旧轮的 ID
    act(() => result.current.setQuestion('清空后的新问题', 'career', ''))
    expect(draftStore.load()?.id).not.toBe(draft.id)
  })

  it('六爻齐备的草稿恢复到结果确认阶段', () => {
    const draft = createDraft({
      question: '已经摇完的问题',
      category: 'career',
      castAt: '2026-11-10T07:00:00.000Z',
      method: 'simulated-coins',
    })
    draftStore.save({
      ...draft,
      rawValues: [7, 7, 7, 7, 7, 7],
      coinThrows: [1, 2, 3, 4, 5, 6].map((round) => ({
        round: round as 1 | 2 | 3 | 4 | 5 | 6,
        faces: [1, 0, 0] as [0 | 1, 0 | 1, 0 | 1],
        rawValue: 7 as const,
      })),
    })

    const { result } = renderHook(() => useCaseSession())
    expect(result.current.wasRestored).toBe(true)
    expect(result.current.step).toBe('review')
  })
})
