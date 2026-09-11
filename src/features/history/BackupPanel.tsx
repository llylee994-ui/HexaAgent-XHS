import { useMemo, useRef, useState } from 'react'
import { ConfirmDialog, Disclosure } from '../../components'
import type { CaseEntry } from '../../storage/case-db'
import { formatBackup, parseBackup, planRestore, type RestoreOutcome } from './backup-format'

export interface BackupPanelProps {
  entries: readonly CaseEntry[]
  /** 由页面负责访问存储：原样写入记录，返回实际结果 */
  onRestore(records: readonly Record<string, unknown>[]): Promise<RestoreOutcome>
  /** 恢复完成后刷新列表 */
  onRestored(): void
  now?(): string
}

/**
 * 备份与恢复：把记录导出成一段可长按复制的纯文本，也能把这段文本粘回来。
 * 不使用剪贴板 API、不写文件、不联网；恢复只做新增，不覆盖也不删除任何现有记录。
 */
export function BackupPanel({
  entries,
  onRestore,
  onRestored,
  now = () => new Date().toISOString(),
}: BackupPanelProps) {
  const exportRef = useRef<HTMLTextAreaElement>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [includeReadonly, setIncludeReadonly] = useState(true)
  const [backup, setBackup] = useState('')
  const [paste, setPaste] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [plan, setPlan] = useState<
    { toInsert: { raw: Record<string, unknown>; writable: boolean }[]; skippedExisting: number; skippedInvalid: number; rejectedLines: number } | null
  >(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [outcome, setOutcome] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const existingIds = useMemo(() => {
    const ids = new Set<string>()
    for (const entry of entries) {
      if (entry.mode === 'writable') {
        ids.add(entry.value.id)
        continue
      }
      const raw = entry.raw as Record<string, unknown> | null
      const id = raw && typeof raw.id === 'string' ? raw.id : ''
      if (id) ids.add(id)
    }
    return ids
  }, [entries])

  const generate = () => {
    setOutcome(null)
    setBackup(formatBackup(entries, { exportedAt: now(), includeReadonly }))
  }

  const analyze = () => {
    setOutcome(null)
    const parsed = parseBackup(paste)
    if (!parsed.ok) {
      setParseError(parsed.reason)
      setPlan(null)
      return
    }
    setParseError(null)
    setPlan({ ...planRestore(parsed.value.records, existingIds), rejectedLines: parsed.value.rejectedLines })
  }

  const confirmRestore = async () => {
    if (!plan) return
    setBusy(true)
    try {
      const result = await onRestore(plan.toInsert.map((item) => item.raw))
      setOutcome(`已恢复 ${result.inserted} 条${result.failed ? `，${result.failed} 条写入失败` : ''}。`)
      setPaste('')
      setPlan(null)
      onRestored()
    } catch (error) {
      setOutcome(`恢复失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
      setConfirmOpen(false)
    }
  }

  return (
    <section className="backup-panel" aria-label="备份与恢复">
      <h2 className="section-title">备份与恢复</h2>
      <p className="hint">
        卦例只保存在本机。更新小工具前，建议先把备份文本复制到备忘录或聊天窗口保存；万一记录丢失，整段粘贴回来即可恢复。
      </p>

      <Disclosure title="导出备份" open={exportOpen} onToggle={() => setExportOpen((open) => !open)}>
        <label className="field field--inline">
          <input
            type="checkbox"
            checked={includeReadonly}
            onChange={(event) => setIncludeReadonly(event.target.checked)}
          />
          <span className="field__label">包含只读原始记录</span>
        </label>
        <button type="button" className="btn" onClick={generate}>
          生成备份文本
        </button>
        {backup ? (
          <>
            <p className="hint">
              共 {entries.length} 条记录 · {backup.length} 字符（随记录增长，过长时可分批复制）
            </p>
            <textarea
              ref={exportRef}
              aria-label="备份文本"
              className="backup-panel__content"
              readOnly
              rows={8}
              value={backup}
            />
            <button type="button" className="btn" onClick={() => exportRef.current?.select()}>
              全选内容
            </button>
            <p className="hint">已选中全部文本，请使用平台长按菜单复制（本工具不调用剪贴板权限）。</p>
          </>
        ) : null}
      </Disclosure>

      <Disclosure title="恢复备份" open={restoreOpen} onToggle={() => setRestoreOpen((open) => !open)}>
        <label className="field">
          <span className="field__label">粘贴备份文本</span>
          <textarea
            aria-label="粘贴备份文本"
            className="backup-panel__content"
            rows={6}
            value={paste}
            placeholder="把之前保存的问爻备份文本整段粘贴到这里"
            onChange={(event) => {
              setPaste(event.target.value)
              setPlan(null)
              setParseError(null)
            }}
          />
        </label>
        <button type="button" className="btn" onClick={analyze} disabled={!paste.trim()}>
          解析备份
        </button>
        {parseError ? <p className="hint hint--warning">{parseError}</p> : null}
        {plan ? (
          <>
            <p className="hint">
              可恢复 {plan.toInsert.length} 条（其中只读原始记录 {plan.toInsert.filter((item) => !item.writable).length} 条）
              {plan.skippedExisting > 0 ? ` · 已存在跳过 ${plan.skippedExisting} 条` : ''}
              {plan.skippedInvalid > 0 ? ` · 缺少标识跳过 ${plan.skippedInvalid} 条` : ''}
              {plan.rejectedLines > 0 ? ` · 无法识别 ${plan.rejectedLines} 行` : ''}
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setConfirmOpen(true)}
              disabled={plan.toInsert.length === 0 || busy}
            >
              确认恢复
            </button>
          </>
        ) : null}
        {outcome ? <p className="hint">{outcome}</p> : null}
      </Disclosure>

      <ConfirmDialog
        open={confirmOpen}
        title="恢复备份"
        message={`将写入 ${plan?.toInsert.length ?? 0} 条记录。已存在的记录会被跳过，现有数据不会被覆盖或删除。确定继续吗？`}
        confirmText="确认导入"
        onConfirm={() => {
          void confirmRestore()
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  )
}
