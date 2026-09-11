import { describe, expect, it } from 'vitest'
import { createDraft } from '../../src/domain/factories'
import { buildChart } from '../../src/engines/najia/chart'
import { BACKUP_HEADER, formatBackup, parseBackup, planRestore } from '../../src/features/history/backup-format'
import type { CaseEntry } from '../../src/storage/case-db'
import { beijing } from '../fixtures/beijing-time'

function writableEntry(): CaseEntry {
  const castAt = beijing('2026-09-11 20:34').toISOString()
  const draft = createDraft({ question: '备份测试', category: 'career', castAt, method: 'manual' })
  return {
    mode: 'writable',
    value: {
      ...draft,
      status: 'cast',
      title: '备份测试卦',
      rawValues: [7, 7, 7, 8, 8, 8],
      chart: buildChart([7, 7, 7, 8, 8, 8], castAt),
    },
  }
}

function readonlyEntry(): CaseEntry {
  return {
    mode: 'readonly',
    raw: { id: 'legacy-broken', schemaVersion: 1, question: 123 },
    reason: '数据结构校验失败，以只读形式保留',
  }
}

describe('formatBackup', () => {
  it('头部含版本、导出时间、条数与可读目录', () => {
    const text = formatBackup([writableEntry(), readonlyEntry()], { exportedAt: beijing('2026-09-11 21:00').toISOString() })
    const lines = text.split('\n')
    expect(lines[0]).toBe(BACKUP_HEADER)
    expect(text).toContain('# 导出时间：2026-09-11 21:00（北京时间 UTC+8）')
    expect(text).toContain('# 记录数：2（可读 1 / 只读原始记录 1）')
    expect(text).toContain('备份测试卦')
    expect(text).toContain('2026-09-11 20:34')
    expect(text).toContain('数据结构校验失败，以只读形式保留')
  })

  it('正文每行一条记录，且与原始数据完全一致', () => {
    const entries = [writableEntry(), readonlyEntry()]
    const bodyLines = formatBackup(entries, { exportedAt: beijing('2026-09-11 21:00').toISOString() })
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#') && line.trim() !== BACKUP_HEADER)
    expect(bodyLines).toHaveLength(2)
    expect(JSON.parse(bodyLines[0]!)).toEqual((entries[0] as { value: unknown }).value)
    expect(JSON.parse(bodyLines[1]!)).toEqual((entries[1] as { raw: unknown }).raw)
  })

  it('可排除只读原始记录', () => {
    const text = formatBackup([writableEntry(), readonlyEntry()], {
      exportedAt: beijing('2026-09-11 21:00').toISOString(),
      includeReadonly: false,
    })
    expect(text).toContain('# 记录数：1（可读 1 / 只读原始记录 0）')
    expect(text).not.toContain('legacy-broken')
  })
})

describe('parseBackup', () => {
  it('往返一致：导出再解析回到同样的记录', () => {
    const entries = [writableEntry(), readonlyEntry()]
    const text = formatBackup(entries, { exportedAt: beijing('2026-09-11 21:00').toISOString() })
    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.formatVersion).toBe(1)
    expect(parsed.value.records).toHaveLength(2)
    expect(parsed.value.records[0]).toEqual((entries[0] as { value: unknown }).value)
    expect(parsed.value.rejectedLines).toBe(0)
  })

  it('拒绝不是备份的文本', () => {
    const parsed = parseBackup('{"id":"x"}')
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.reason).toContain('不是问爻备份文本')
  })

  it('拒绝来自更新版本的备份', () => {
    const parsed = parseBackup('问爻备份 v2\n{"id":"x"}')
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.reason).toContain('更新版本')
  })

  it('统计损坏行，但仍恢复可解析的记录', () => {
    const text = `${BACKUP_HEADER}\n{"id":"a","schemaVersion":1}\n这不是 JSON\n[1,2,3]\n`
    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.records).toHaveLength(1)
    expect(parsed.value.rejectedLines).toBe(2)
  })

  it('没有任何记录时明确失败', () => {
    const parsed = parseBackup(`${BACKUP_HEADER}\n# 只有头部\n`)
    expect(parsed.ok).toBe(false)
  })

  it('忽略头部注释行', () => {
    const parsed = parseBackup(`${BACKUP_HEADER}\n# 目录：\n#   1. 甲 · 可读\n{"id":"a"}\n`)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.records).toEqual([{ id: 'a' }])
  })
})

describe('planRestore', () => {
  it('跳过已存在的 id、跳过缺少 id 的记录，并标注可读性', () => {
    const plan = planRestore(
      [
        { id: 'a', schemaVersion: 2 },
        { id: 'b', schemaVersion: 1, question: 123 },
        { question: '没有 id' },
      ],
      new Set(['a']),
    )
    expect(plan.skippedExisting).toBe(1)
    expect(plan.skippedInvalid).toBe(1)
    expect(plan.toInsert).toHaveLength(1)
    expect(plan.toInsert[0]!.writable).toBe(false)
  })

  it('同一份备份里的重复 id 只导入一次', () => {
    const plan = planRestore([{ id: 'a' }, { id: 'a' }], new Set())
    expect(plan.toInsert).toHaveLength(1)
    expect(plan.skippedExisting).toBe(1)
  })

  it('当前版本的合法记录标记为可读', () => {
    const value = (writableEntry() as { value: Record<string, unknown> }).value
    const plan = planRestore([value], new Set())
    expect(plan.toInsert[0]!.writable).toBe(true)
  })
})
