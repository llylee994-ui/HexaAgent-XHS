import { beforeEach, describe, expect, it } from 'vitest'
import type { ChartOverrides } from '../../src/engines/najia/chart'
import type { ManualDraftSnapshot } from '../../src/features/manual/manual-draft-store'
import { manualDraftStore } from '../../src/features/manual/manual-draft-store'

function buildManualDraft(overrides: Partial<ManualDraftSnapshot> = {}): ManualDraftSnapshot {
  return {
    version: 1,
    caseId: 'manual-case-1',
    question: '考试是否顺利？',
    category: 'study',
    note: '准备充分',
    castAt: '2026-08-31T03:00:00.000Z',
    rawValues: [7, 7, 7, 8, 8, 8],
    overrides: { lines: { 1: { liushen: '青龙' } } } satisfies ChartOverrides,
    selectedHexagramName: '地天泰',
    openFushen: [1, 4],
    updatedAt: '2026-08-31T03:01:00.000Z',
    ...overrides,
  }
}

beforeEach(() => localStorage.clear())

describe('手动排盘草稿存储', () => {
  it('round-trips overrides, selected hexagram and open fushen rows', () => {
    const snapshot = buildManualDraft()
    manualDraftStore.save(snapshot)
    expect(manualDraftStore.load()).toEqual(snapshot)
  })

  it('round-trips a relative category', () => {
    const snapshot = buildManualDraft({ category: 'children' })
    manualDraftStore.save(snapshot)
    expect(manualDraftStore.load()?.category).toBe('children')
  })

  it('leaves an invalid stored draft untouched by the current case database', () => {
    localStorage.setItem('wenyao:manual-editor-draft:v1', '{bad json')
    expect(manualDraftStore.load()).toBeNull()
  })

  it.each([
    { version: 2 },
    { rawValues: [7, 7, 7, 8, 8] },
    { rawValues: [7, 7, 7, 8, 8, 8, 7] },
    { castAt: 'not-a-date' },
    { selectedHexagramName: '不存在的卦' },
  ])('rejects invalid snapshot %#', (change) => {
    localStorage.setItem(
      'wenyao:manual-editor-draft:v1',
      JSON.stringify(buildManualDraft(change as Partial<ManualDraftSnapshot>)),
    )
    expect(manualDraftStore.load()).toBeNull()
  })

  it('容器禁用存储（读取 localStorage 属性即抛）时 load 返回 null 而不是抛异常', () => {
    // 关键回归：旧实现直接访问 globalThis.localStorage，容器沙箱里这一步就抛 SecurityError，
    // 手动排盘页会在渲染期崩溃并让整棵树被卸载
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError')
      },
    })
    try {
      expect(manualDraftStore.load()).toBeNull()
      expect(() => manualDraftStore.clear()).not.toThrow()
      expect(() => manualDraftStore.save(buildManualDraft())).toThrow('localStorage 不可用')
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original)
    }
  })
})
