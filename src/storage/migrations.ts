import type { DivinationCase } from '../domain/types'
import { SCHEMA_VERSION } from '../domain/versions'
import { validateCase } from '../domain/validation'

export type MigrationResult =
  | { mode: 'writable'; value: DivinationCase }
  | { mode: 'readonly'; raw: unknown; reason: string }

// 逐级迁移表：键为来源 schemaVersion，函数将该版本记录转换为目标版本。
// 当前 SCHEMA_VERSION = 1 为首个版本，暂无历史版本需要迁移。
type MigrationStep = (record: Record<string, unknown>) => Record<string, unknown>
const MIGRATIONS: Partial<Record<number, MigrationStep>> = {}

function readonly(raw: unknown, reason: string): MigrationResult {
  return { mode: 'readonly', raw, reason }
}

/**
 * 把持久化记录迁移到当前 schemaVersion。
 * 迁移失败或结构不合法时返回 readonly，调用方必须以只读形式保留原始数据。
 */
export function migrateCase(record: unknown): MigrationResult {
  try {
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      return readonly(record, '数据不是卦例对象')
    }
    const source = record as Record<string, unknown>
    if (typeof source.schemaVersion !== 'number') {
      return readonly(record, '缺少 schemaVersion')
    }
    if (source.schemaVersion > SCHEMA_VERSION) {
      return readonly(record, '数据来自更新版本的小工具，当前版本只读展示')
    }

    let value = source
    for (let version = source.schemaVersion; version < SCHEMA_VERSION; version++) {
      const step = MIGRATIONS[version]
      if (!step) {
        return readonly(record, `缺少从版本 ${version} 的迁移路径`)
      }
      value = step(value)
    }

    const validation = validateCase(value)
    if (!validation.ok) {
      return readonly(record, '数据结构校验失败，以只读形式保留')
    }
    return { mode: 'writable', value: value as unknown as DivinationCase }
  } catch (error) {
    return readonly(record, `迁移失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}
