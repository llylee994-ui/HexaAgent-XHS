import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { createDraft } from '../../src/domain/factories'
import { buildChart } from '../../src/engines/najia/chart'
import { HistoryPage } from '../../src/features/history/HistoryPage'
import { createCaseRepository } from '../../src/storage/case-db'
import { beijing } from '../fixtures/beijing-time'

const LEGACY_HINT = '旧版记录未保存时区，现按北京时间显示；原排盘结果未重新计算。'
const CAST_AT = beijing('2026-08-28 12:00').toISOString()
const RAW_VALUES = [7, 7, 7, 8, 8, 8] as const

function currentCase(title: string) {
  const draft = createDraft({ question: `${title}的问题`, category: 'career', castAt: CAST_AT, method: 'manual' })
  return { ...draft, status: 'cast' as const, title, rawValues: [...RAW_VALUES], chart: buildChart(RAW_VALUES, CAST_AT) }
}

/** 0.1.0 形态记录：schemaVersion 1、engineVersion 0.1.0、没有 timeZone */
function legacyRecord(title: string): Record<string, unknown> & { id: string; chart: unknown } {
  const value = currentCase(title)
  const { timeZone: _timeZone, ...withoutTimeZone } = value
  void _timeZone
  return { ...withoutTimeZone, schemaVersion: 1, engineVersion: '0.1.0' }
}

function seedRawRecord(factory: IDBFactory, record: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.open('wenyao', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('cases')) {
        db.createObjectStore('cases', { keyPath: 'id' })
      }
    }
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('cases', 'readwrite')
      transaction.objectStore('cases').put(record)
      transaction.oncomplete = () => {
        db.close()
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)
    }
    request.onerror = () => reject(request.error)
  })
}

describe('旧版卦例的时区假设提示', () => {
  it('只在迁移旧记录卡片上显示，当前记录不显示', async () => {
    const factory = new IDBFactory()
    const repository = createCaseRepository(factory)
    await repository.put(currentCase('当前卦例'))
    await seedRawRecord(factory, legacyRecord('旧版卦例'))

    render(<HistoryPage repository={repository} onView={() => {}} onBack={() => {}} />)
    expect(await screen.findByText('旧版卦例')).toBeTruthy()

    const cards = [...document.querySelectorAll('.history-card')]
    expect(cards).toHaveLength(2)
    const legacyCards = cards.filter((card) => card.textContent?.includes(LEGACY_HINT))
    expect(legacyCards).toHaveLength(1)
    expect(legacyCards[0]!.textContent).toContain('旧版卦例')
    expect(legacyCards[0]!.textContent).not.toContain('当前卦例')
  })

  it('提示只出现在历史列表，且旧记录迁移后可读、快照不被重算', async () => {
    const factory = new IDBFactory()
    const repository = createCaseRepository(factory)
    const legacy = legacyRecord('旧版卦例')
    await seedRawRecord(factory, legacy)

    render(<HistoryPage repository={repository} onView={() => {}} onBack={() => {}} />)
    expect(await screen.findByText(LEGACY_HINT)).toBeTruthy()
    expect(screen.getAllByText(LEGACY_HINT)).toHaveLength(1)

    const stored = await repository.get(legacy.id)
    expect(stored?.schemaVersion).toBe(2)
    expect(stored?.timeZone?.assumed).toBe(true)
    expect(stored?.chart).toEqual(legacy.chart)
  })
})
