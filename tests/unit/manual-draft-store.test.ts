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
})
