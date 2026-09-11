import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { createDraft } from '../../src/domain/factories'
import type { DivinationCase } from '../../src/domain/types'
import { buildChart } from '../../src/engines/najia/chart'
import { HistoryPage } from '../../src/features/history/HistoryPage'
import { createCaseRepository } from '../../src/storage/case-db'
import { beijing } from '../fixtures/beijing-time'

const RAW_VALUES = [7, 7, 7, 8, 8, 8] as const

function buildCase(title: string): DivinationCase {
  const castAt = beijing('2026-09-11 20:34').toISOString()
  const draft = createDraft({ question: `${title}的问题`, category: 'career', castAt, method: 'manual' })
  return {
    ...draft,
    status: 'cast',
    title,
    rawValues: [...RAW_VALUES],
    chart: buildChart(RAW_VALUES, castAt),
  }
}

async function setup(seedTitles: readonly string[]) {
  const repository = createCaseRepository(new IDBFactory())
  const cases: DivinationCase[] = []
  for (const title of seedTitles) {
    const value = buildCase(title)
    await repository.put(value)
    cases.push(value)
  }
  render(<HistoryPage repository={repository} onView={() => {}} onBack={() => {}} />)
  await waitFor(async () => {
    expect(await repository.list()).toHaveLength(seedTitles.length)
  })
  return { repository, cases }
}

async function exportBackup(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '展开导出备份' }))
  await user.click(screen.getByRole('button', { name: '生成备份文本' }))
  return (screen.getByLabelText('备份文本') as HTMLTextAreaElement).value
}

async function pasteBackup(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByRole('button', { name: '展开恢复备份' }))
  const box = screen.getByLabelText('粘贴备份文本')
  await user.click(box)
  await user.paste(text)
  await user.click(screen.getByRole('button', { name: '解析备份' }))
}

describe('备份与恢复', () => {
  it('导出全部卦例为可粘贴文本', async () => {
    const user = userEvent.setup()
    const { cases } = await setup(['备份用例1', '备份用例2'])

    const text = await exportBackup(user)
    expect(text).toContain('问爻备份 v1')
    expect(text).toContain('# 记录数：2（可读 2 / 只读原始记录 0）')
    expect(text).toContain('备份用例1')
    expect(text).toContain('2026-09-11 20:34')
    for (const value of cases) {
      expect(text).toContain(value.id)
    }
    expect(screen.getByText(/共 2 条记录/)).toBeTruthy()
  })

  it('把备份粘回来可以恢复成新记录', async () => {
    const user = userEvent.setup()
    const { repository, cases } = await setup(['备份用例1'])

    const text = await exportBackup(user)
    const restoredId = 'restored-case-1'
    await pasteBackup(user, text.replace(cases[0]!.id, restoredId))

    expect(await screen.findByText(/可恢复 1 条/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '确认恢复' }))
    await user.click(screen.getByRole('button', { name: '确认导入' }))

    expect(await screen.findByText(/已恢复 1 条/)).toBeTruthy()
    await waitFor(async () => {
      const restored = await repository.get(restoredId)
      expect(restored?.title).toBe('备份用例1')
      expect(restored?.chart).toEqual(cases[0]!.chart)
    })
  })

  it('已存在的记录被跳过，不覆盖现有数据', async () => {
    const user = userEvent.setup()
    const { repository, cases } = await setup(['备份用例1'])

    const text = await exportBackup(user)
    // 同一 id、但内容被改过的备份
    await pasteBackup(user, text.replace('备份用例1的问题', '被篡改的问题'))

    expect(await screen.findByText(/已存在跳过 1 条/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '确认恢复' })).toBeDisabled()
    expect((await repository.get(cases[0]!.id))?.question).toBe('备份用例1的问题')
  })

  it('只读原始记录也能恢复，并保持只读形态', async () => {
    const user = userEvent.setup()
    const { repository } = await setup([])

    await pasteBackup(
      user,
      '问爻备份 v1\n# 导出时间：2026-09-11 21:00（北京时间 UTC+8）\n{"id":"raw-legacy","schemaVersion":1,"question":123}\n',
    )

    expect(await screen.findByText(/其中只读原始记录 1 条/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '确认恢复' }))
    await user.click(screen.getByRole('button', { name: '确认导入' }))

    expect(await screen.findByText('原始记录（只读）')).toBeTruthy()
    expect(await repository.hasRecord('raw-legacy')).toBe(true)
  })

  it('不是备份文本时给出明确提示', async () => {
    const user = userEvent.setup()
    await setup([])

    await pasteBackup(user, '随便一段文字')
    expect(await screen.findByText(/不是问爻备份文本/)).toBeTruthy()
  })
})
