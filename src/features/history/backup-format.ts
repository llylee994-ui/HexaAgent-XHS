import type { CaseEntry } from '../../storage/case-db'
import { migrateCase } from '../../storage/migrations'
import { CAST_TIME_ZONE } from '../../domain/time-zone'
import { formatZonedDateTime, formatZonedTimestamp } from '../../engines/calendar/zoned-time'

/**
 * 纯文本备份格式：头部是人类可读的目录与说明，正文每行一条完整 JSON 记录。
 *
 * 设计约束（小红书沙箱）：只产生一段可粘贴文本，不经网络、不写文件、不调用剪贴板 API；
 * 复制由用户在平台长按菜单完成。格式保持可被 parseBackup 完整读回，作为存储被清空时的兜底。
 */
export const BACKUP_FORMAT_VERSION = 1
export const BACKUP_HEADER = `问爻备份 v${BACKUP_FORMAT_VERSION}`

export interface BackupOptions {
  /** 导出时刻（绝对时刻 ISO） */
  exportedAt: string
  /** 是否包含迁移失败的只读原始记录（默认包含：这是抢救数据的最后机会） */
  includeReadonly?: boolean
}

export interface RestoreOutcome {
  inserted: number
  failed: number
}

function label(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  const single = (text || fallback).replace(/\s+/g, ' ')
  return single.length > 48 ? `${single.slice(0, 48)}…` : single
}

/** 卦例记录 → 可粘贴的备份文本 */
export function formatBackup(entries: readonly CaseEntry[], options: BackupOptions): string {
  const included = options.includeReadonly === false
    ? entries.filter((entry) => entry.mode === 'writable')
    : [...entries]

  const readable = included.filter((entry) => entry.mode === 'writable').length
  const lines: string[] = [
    BACKUP_HEADER,
    `# 导出时间：${formatZonedTimestamp(options.exportedAt, CAST_TIME_ZONE)}`,
    `# 记录数：${included.length}（可读 ${readable} / 只读原始记录 ${included.length - readable}）`,
    '# 目录：',
  ]

  included.forEach((entry, index) => {
    if (entry.mode === 'writable') {
      lines.push(
        `#   ${index + 1}. ${label(entry.value.title || entry.value.question, '未命名卦例')}` +
          ` · ${formatZonedDateTime(entry.value.castAt, entry.value.timeZone?.offsetMinutes)} · 可读`,
      )
    } else {
      lines.push(`#   ${index + 1}. ${label(entry.reason, '迁移失败')} · 只读原始记录`)
    }
  })

  lines.push('# 说明：以下每行是一条完整记录，请连同以上头部一起保存。')
  lines.push('# 恢复：在「卦例记录 → 恢复备份」中整段粘贴，已存在的记录会被跳过，不会覆盖。')

  for (const entry of included) {
    lines.push(JSON.stringify(entry.mode === 'writable' ? entry.value : entry.raw))
  }

  return lines.join('\n')
}

export interface ParsedBackup {
  formatVersion: number
  records: Record<string, unknown>[]
  /** 无法解析为 JSON 对象的行数 */
  rejectedLines: number
}

export type BackupParseResult =
  | { ok: true; value: ParsedBackup }
  | { ok: false; reason: string }

/** 备份文本 → 记录数组；只认以「问爻备份 vN」开头的文本 */
export function parseBackup(text: string): BackupParseResult {
  const lines = text.split(/\r?\n/)
  const headerIndex = lines.findIndex((line) => line.trim().startsWith('问爻备份'))
  if (headerIndex < 0) {
    return { ok: false, reason: `不是问爻备份文本（缺少以「${BACKUP_HEADER}」开头的首行）` }
  }

  const versionMatch = /问爻备份\s*v(\d+)/.exec(lines[headerIndex]!.trim())
  const formatVersion = versionMatch ? Number(versionMatch[1]) : NaN
  if (!Number.isFinite(formatVersion)) {
    return { ok: false, reason: '无法识别备份格式版本' }
  }
  if (formatVersion > BACKUP_FORMAT_VERSION) {
    return { ok: false, reason: `备份来自更新版本（v${formatVersion}），当前版本只支持 v${BACKUP_FORMAT_VERSION}` }
  }

  const records: Record<string, unknown>[] = []
  let rejectedLines = 0
  for (const line of lines.slice(headerIndex + 1)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        records.push(parsed as Record<string, unknown>)
      } else {
        rejectedLines += 1
      }
    } catch {
      rejectedLines += 1
    }
  }

  if (records.length === 0) {
    return { ok: false, reason: '没有解析到任何记录' }
  }
  return { ok: true, value: { formatVersion, records, rejectedLines } }
}

export interface RestorePlan {
  toInsert: { raw: Record<string, unknown>; writable: boolean }[]
  /** 库中已存在同 id 记录而跳过的条数 */
  skippedExisting: number
  /** 缺少 id（无法作为键写入）而跳过的条数 */
  skippedInvalid: number
}

/**
 * 恢复计划：已存在的 id 一律跳过（含只读原始记录），不覆盖任何现有数据。
 * writable 标记决定恢复后该条以可读还是只读形态出现。
 */
export function planRestore(
  records: readonly Record<string, unknown>[],
  existingIds: ReadonlySet<string>,
): RestorePlan {
  const toInsert: RestorePlan['toInsert'] = []
  const seen = new Set<string>()
  let skippedExisting = 0
  let skippedInvalid = 0

  for (const raw of records) {
    const id = typeof raw.id === 'string' ? raw.id.trim() : ''
    if (!id) {
      skippedInvalid += 1
      continue
    }
    if (existingIds.has(id) || seen.has(id)) {
      skippedExisting += 1
      continue
    }
    seen.add(id)
    toInsert.push({ raw, writable: migrateCase(raw).mode === 'writable' })
  }

  return { toInsert, skippedExisting, skippedInvalid }
}
