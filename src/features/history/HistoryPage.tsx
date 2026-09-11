import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DivinationCase } from '../../domain/types'
import { ConfirmDialog, PageFrame } from '../../components'
import type { HistoryViewState, PageFrameBinding } from '../../app/navigation'
import { DETACHED_FRAME } from '../../app/navigation'
import { createCaseRepository, type CaseEntry, type CaseRepository } from '../../storage/case-db'
import { StorageFullError } from '../../storage/errors'
import { formatZonedDateTime } from '../../engines/calendar/zoned-time'
import { STATUS_LABEL } from './status'
import { BackupPanel } from './BackupPanel'
import type { RestoreOutcome } from './backup-format'

export interface HistoryPageProps {
  repository?: CaseRepository
  initialQuery?: string
  initialScrollY?: number
  onViewStateChange?(state: HistoryViewState): void
  onView(caseValue: DivinationCase): void
  onBack(): void
  frame?: PageFrameBinding
}

function HistoryCard({
  value,
  onView,
  onDuplicate,
  onDelete,
}: {
  value: DivinationCase
  onView(value: DivinationCase): void
  onDuplicate(value: DivinationCase): void
  onDelete(value: DivinationCase): void
}) {
  return (
    <li className="history-card">
      <div className="history-card__head">
        <button type="button" className="history-card__title" onClick={() => onView(value)}>
          {value.title || value.question}
        </button>
        <span className={`status-chip status-chip--${value.status}`}>{STATUS_LABEL[value.status]}</span>
      </div>
      <p className="history-card__meta">
        {value.chart?.original.name ?? '未排盘'} · {formatZonedDateTime(value.updatedAt, value.timeZone?.offsetMinutes)}
      </p>
      <p className="history-card__question">{value.question}</p>
      <div className="history-card__actions">
        <button type="button" className="btn btn--small" onClick={() => onDuplicate(value)}>
          修改为副本
        </button>
        <button type="button" className="btn btn--small" onClick={() => onDelete(value)}>
          删除
        </button>
      </div>
    </li>
  )
}

function ReadonlyCard({ raw, reason }: { raw: unknown; reason: string }) {
  const summary = JSON.stringify(raw).slice(0, 120)
  return (
    <li className="history-card history-card--readonly">
      <div className="history-card__head">
        <span className="history-card__title">原始记录（只读）</span>
        <span className="status-chip status-chip--readonly">只读</span>
      </div>
      <p className="history-card__meta">{reason}</p>
      <p className="history-card__question">{summary}…</p>
    </li>
  )
}

/** 卦例记录：时间线卡片 + 搜索 + 删除确认 + 修改副本；只读记录与存储满有明确提示 */
export function HistoryPage({
  repository: injectedRepository,
  initialQuery = '',
  initialScrollY = 0,
  onViewStateChange,
  onView,
  frame = DETACHED_FRAME,
}: HistoryPageProps) {
  // 仓库实例必须稳定，否则每次渲染都会触发重新加载并覆盖搜索结果
  const repository = useMemo(() => injectedRepository ?? createCaseRepository(), [injectedRepository])
  const [entries, setEntries] = useState<CaseEntry[]>([])
  const [query, setQuery] = useState(initialQuery)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DivinationCase | null>(null)

  const load = useCallback(async () => {
    setEntries(await repository.listEntries())
  }, [repository])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    onViewStateChange?.({ query, scrollY: window.scrollY })
  }, [onViewStateChange, query])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      try {
        if (!/jsdom/i.test(window.navigator.userAgent)) {
          window.scrollTo({ top: initialScrollY, left: 0, behavior: 'auto' })
        }
      } catch {
        // jsdom and older containers may not implement scrollTo options.
      }
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [initialScrollY])

  const runSearch = async () => {
    const normalized = query.trim()
    const currentState = (window.history.state ?? {}) as { wenYaoIndex?: number }
    window.history.pushState({ wenYaoIndex: currentState.wenYaoIndex, historyView: { query, scrollY: window.scrollY } }, '')
    if (!normalized) {
      await load()
      return
    }
    const results = await repository.search(normalized)
    setEntries(results.map((value) => ({ mode: 'writable', value }) as CaseEntry))
  }

  const clearSearch = async () => {
    setQuery('')
    await load()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await repository.delete(deleteTarget.id)
      setError(null)
    } catch (err) {
      setError(err instanceof StorageFullError ? '存储空间不足，请清理旧卦例后再试。' : `删除失败：${String(err)}`)
    }
    setDeleteTarget(null)
    await load()
  }

  const duplicate = async (value: DivinationCase) => {
    try {
      const copy = await repository.duplicate(value.id)
      onView(copy)
    } catch (err) {
      setError(
        err instanceof StorageFullError
          ? '存储空间不足，请清理旧卦例后重试；已有卦例未受影响。'
          : `复制失败：${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  const viewCase = (value: DivinationCase) => {
    onViewStateChange?.({ query, scrollY: window.scrollY })
    onView(value)
  }

  /** 备份恢复：只新增，先查原始记录是否存在（get 对只读记录返回 null，不能用它判断） */
  const restoreBackup = async (records: readonly Record<string, unknown>[]): Promise<RestoreOutcome> => {
    let inserted = 0
    let failed = 0
    for (const record of records) {
      const id = typeof record.id === 'string' ? record.id : ''
      try {
        if (!id || (await repository.hasRecord(id))) continue
        await repository.putRaw(record)
        inserted += 1
      } catch (error) {
        failed += 1
        if (error instanceof StorageFullError) {
          setError('存储空间不足，部分备份未能写入；已有记录未受影响。建议先删除旧卦例再重试。')
        }
      }
    }
    return { inserted, failed }
  }

  return (
    <PageFrame title="卦例记录" canGoBack={frame.canGoBack} direction={frame.direction} onBack={frame.onBack}>
      <section className="page">

      <div className="search-bar">
        <input
          aria-label="搜索卦例"
          placeholder="搜索问题、标题、卦名或标签"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" className="btn" onClick={runSearch}>
          搜索
        </button>
        <button type="button" className="btn" onClick={clearSearch}>
          清除
        </button>
      </div>

      {error ? <p className="hint hint--warning">{error}</p> : null}

      {entries.length === 0 ? (
        <p className="hint">还没有卦例，先从一次摇卦开始。</p>
      ) : (
        <ul className="history-list">
          {entries.map((entry, index) =>
            entry.mode === 'writable' ? (
              <HistoryCard
                key={entry.value.id}
                value={entry.value}
                onView={viewCase}
                onDuplicate={duplicate}
                onDelete={setDeleteTarget}
              />
            ) : (
              <ReadonlyCard key={`readonly-${index}`} raw={entry.raw} reason={entry.reason} />
            ),
          )}
        </ul>
      )}

      <BackupPanel entries={entries} onRestore={restoreBackup} onRestored={load} />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除卦例"
        message={`确定删除「${(deleteTarget?.title || deleteTarget?.question) ?? ''}」？删除后无法恢复。`}
        confirmText="确认删除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      </section>
    </PageFrame>
  )
}
