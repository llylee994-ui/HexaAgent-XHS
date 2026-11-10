import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  selectMode,
  selected,
  onView,
  onDuplicate,
  onDelete,
  onToggleSelect,
}: {
  value: DivinationCase
  selectMode: boolean
  selected: boolean
  onView(value: DivinationCase): void
  onDuplicate(value: DivinationCase): void
  onDelete(value: DivinationCase): void
  onToggleSelect(id: string): void
}) {
  const label = value.title || value.question
  const body = (
    <>
      <div className={`history-card__head${selectMode ? ' history-card__head--selectable' : ''}`}>
        {selectMode ? (
          <input
            type="checkbox"
            className="history-card__checkbox"
            checked={selected}
            aria-label={`选择「${label}」`}
            onChange={() => onToggleSelect(value.id)}
          />
        ) : null}
        {selectMode ? (
          <span className="history-card__title">{label}</span>
        ) : (
          <button type="button" className="history-card__title" onClick={() => onView(value)}>
            {label}
          </button>
        )}
        <span className={`status-chip status-chip--${value.status}`}>{STATUS_LABEL[value.status]}</span>
      </div>
      <p className="history-card__meta">
        {value.chart?.original.name ?? '未排盘'} · {formatZonedDateTime(value.updatedAt, value.timeZone?.offsetMinutes)}
      </p>
      <p className="history-card__question">{value.question}</p>
      {value.timeZone?.assumed ? (
        <p className="hint history-card__legacy">旧版记录未保存时区，现按北京时间显示；原排盘结果未重新计算。</p>
      ) : null}
      {selectMode ? null : (
        <div className="history-card__actions">
          <button type="button" className="btn btn--small" onClick={() => onDuplicate(value)}>
            修改为副本
          </button>
          <button type="button" className="btn btn--small" onClick={() => onDelete(value)}>
            删除
          </button>
        </div>
      )}
    </>
  )

  if (selectMode) {
    // 整张卡片即勾选区域：多选时卡片不再跳转，避免误触进入结果页
    return (
      <li className={`history-card${selected ? ' history-card--selected' : ''}`}>
        <label className="history-card__picker">{body}</label>
      </li>
    )
  }
  return <li className="history-card">{body}</li>
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
  const [allEntries, setAllEntries] = useState<CaseEntry[] | null>(null)
  const [query, setQuery] = useState(initialQuery)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DivinationCase | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [loading, setLoading] = useState<'records' | 'search' | null>('records')
  const requestId = useRef(0)

  /** 可批量删除的记录：只读记录与现状一致，不参与选择 */
  const selectable = useMemo(
    () => entries.flatMap((entry) => (entry.mode === 'writable' ? [entry.value] : [])),
    [entries],
  )
  const selectedCount = selectable.filter((value) => selectedIds.has(value.id)).length
  const readonlyCount = entries.length - selectable.length
  const allSelected = selectable.length > 0 && selectedCount === selectable.length

  /**
   * 已生效的搜索词（'' 表示没有搜索结果）。只在事件处理器里读写，不参与渲染，
   * 因此不会把重载函数拖进依赖，避免每次搜索都多跑一轮读取。
   */
  const appliedQuery = useRef('')

  const load = useCallback(async () => {
    const term = appliedQuery.current
    const currentRequest = ++requestId.current
    setLoading(term ? 'search' : 'records')
    try {
      // 全量列表始终刷新：工具栏计数与备份导出都用它，删除后不能留下已删除的记录
      const all = await repository.listEntries()
      if (currentRequest !== requestId.current) return
      setAllEntries(all)
      if (!term) {
        setEntries(all)
      } else {
        // 有生效搜索时维持过滤，删除后不把列表跳回全量
        const results = await repository.search(term)
        if (currentRequest !== requestId.current) return
        setEntries(results.map((value): CaseEntry => ({ mode: 'writable', value })))
      }
      setError(null)
    } catch (err) {
      if (currentRequest !== requestId.current) return
      setError(
        term
          ? `搜索卦例失败：${err instanceof Error ? err.message : String(err)}`
          : `加载卦例失败：${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      if (currentRequest === requestId.current) setLoading(null)
    }
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
    // 列表内容即将变化，已选中的记录可能不再可见，一律清空选择
    setSelectedIds(new Set())
    appliedQuery.current = normalized
    await load()
  }

  const clearSearch = async () => {
    setQuery('')
    setSelectedIds(new Set())
    appliedQuery.current = ''
    await load()
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds((current) => {
      const visible = selectable.map((value) => value.id)
      const everyChosen = visible.length > 0 && visible.every((id) => current.has(id))
      return everyChosen ? new Set() : new Set(visible)
    })
  }

  const confirmBatchDelete = async () => {
    const ids = selectable.filter((value) => selectedIds.has(value.id)).map((value) => value.id)
    setBatchDeleteOpen(false)
    if (ids.length === 0) {
      return
    }
    try {
      await repository.deleteMany(ids)
      setError(null)
    } catch (err) {
      setError(`删除失败：${err instanceof Error ? err.message : String(err)}`)
    }
    exitSelectMode()
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

      {selectMode ? (
        <div className="history-batch">
          <div className="history-batch__row">
            <span className="history-toolbar__count">
              已选 {selectedCount} 条 / 可删 {selectable.length} 条
            </span>
            <div className="history-toolbar__actions">
              <button
                type="button"
                className="btn btn--small"
                onClick={toggleSelectAll}
                disabled={selectable.length === 0}
              >
                {allSelected ? '取消全选' : '全选'}
              </button>
              <button type="button" className="btn btn--small" onClick={exitSelectMode}>
                完成
              </button>
            </div>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            disabled={selectedCount === 0}
            onClick={() => setBatchDeleteOpen(true)}
          >
            删除选中（{selectedCount} 条）
          </button>
          {readonlyCount > 0 ? (
            <p className="hint">另有 {readonlyCount} 条只读记录不参与批量删除。</p>
          ) : null}
        </div>
      ) : (
        <div className="history-toolbar">
          <span className="history-toolbar__count">
            {allEntries === null ? (loading ? '正在读取记录' : '记录暂不可用') : `共 ${allEntries.length} 条记录`}
          </span>
          <div className="history-toolbar__actions">
            {/* 没有可删记录时不渲染「管理」：留一个点不动的灰按钮容易被当成"按钮坏了" */}
            {selectable.length > 0 ? (
              <button type="button" className="btn btn--small" onClick={() => setSelectMode(true)}>
                管理
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn--small"
              aria-expanded={backupOpen}
              aria-controls="history-backup-tools"
              disabled={allEntries === null}
              onClick={() => setBackupOpen((open) => !open)}
            >
              {backupOpen ? '收起备份与恢复' : '展开备份与恢复'}
            </button>
          </div>
        </div>
      )}

      <div id="history-backup-tools" hidden={!backupOpen}>
        <BackupPanel entries={allEntries ?? []} onRestore={restoreBackup} onRestored={load} />
      </div>

      <div className="search-bar">
        <input
          aria-label="搜索卦例"
          placeholder="搜索问题、标题、卦名或标签"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" className="btn" onClick={runSearch} disabled={allEntries === null}>
          搜索
        </button>
        <button type="button" className="btn" onClick={clearSearch}>
          清除
        </button>
      </div>

      {error ? <p className="hint hint--warning">{error}</p> : null}

      {loading ? (
        <p className="hint history-loading" role="status" aria-live="polite">
          {loading === 'search' ? '正在搜索卦例…' : '正在加载卦例…'}
        </p>
      ) : entries.length === 0 && !error ? (
        <p className="hint">{query.trim() ? '没有找到匹配的卦例。' : '还没有卦例，先从一次摇卦开始。'}</p>
      ) : (
        <ul className="history-list">
          {entries.map((entry, index) =>
            entry.mode === 'writable' ? (
              <HistoryCard
                key={entry.value.id}
                value={entry.value}
                selectMode={selectMode}
                selected={selectedIds.has(entry.value.id)}
                onView={viewCase}
                onDuplicate={duplicate}
                onDelete={setDeleteTarget}
                onToggleSelect={toggleSelect}
              />
            ) : (
              <ReadonlyCard key={`readonly-${index}`} raw={entry.raw} reason={entry.reason} />
            ),
          )}
        </ul>
      )}

      <ConfirmDialog
        open={batchDeleteOpen}
        title="删除选中的卦例"
        message={`确定删除选中的 ${selectedCount} 条卦例？删除后无法恢复。`}
        confirmText="确认删除"
        onConfirm={confirmBatchDelete}
        onCancel={() => setBatchDeleteOpen(false)}
      />

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
