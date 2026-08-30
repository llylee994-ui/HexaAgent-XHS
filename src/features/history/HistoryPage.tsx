import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DivinationCase } from '../../domain/types'
import { ConfirmDialog } from '../../components'
import { createCaseRepository, type CaseEntry, type CaseRepository } from '../../storage/case-db'
import { StorageFullError } from '../../storage/errors'
import { STATUS_LABEL } from './status'

export interface HistoryPageProps {
  repository?: CaseRepository
  onView(caseValue: DivinationCase): void
  onBack(): void
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
        {value.chart?.original.name ?? '未排盘'} · {value.updatedAt.slice(0, 16).replace('T', ' ')}
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
export function HistoryPage({ repository: injectedRepository, onView, onBack }: HistoryPageProps) {
  // 仓库实例必须稳定，否则每次渲染都会触发重新加载并覆盖搜索结果
  const repository = useMemo(() => injectedRepository ?? createCaseRepository(), [injectedRepository])
  const [entries, setEntries] = useState<CaseEntry[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DivinationCase | null>(null)

  const load = useCallback(async () => {
    setEntries(await repository.listEntries())
  }, [repository])

  useEffect(() => {
    void load()
  }, [load])

  const runSearch = async () => {
    const normalized = query.trim()
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

  return (
    <section className="page">
      <h1 className="page__title">卦例记录</h1>

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
                onView={onView}
                onDuplicate={duplicate}
                onDelete={setDeleteTarget}
              />
            ) : (
              <ReadonlyCard key={`readonly-${index}`} raw={entry.raw} reason={entry.reason} />
            ),
          )}
        </ul>
      )}

      <button type="button" className="btn" onClick={onBack}>
        返回首页
      </button>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除卦例"
        message={`确定删除「${(deleteTarget?.title || deleteTarget?.question) ?? ''}」？删除后无法恢复。`}
        confirmText="确认删除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  )
}
