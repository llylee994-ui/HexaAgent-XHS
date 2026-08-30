import { useEffect, useState } from 'react'
import type { DivinationCase } from '../../domain/types'
import { createCaseRepository } from '../../storage/case-db'
import { STATUS_LABEL } from '../history/status'

const repository = createCaseRepository()

export interface HomePageProps {
  onNavigate(route: 'cast' | 'manual' | 'history'): void
  onViewCase(caseValue: DivinationCase): void
}

/** 首页：两个主入口卡 + 卦例记录入口 + 最近三条卦例 */
export function HomePage({ onNavigate, onViewCase }: HomePageProps) {
  const [recent, setRecent] = useState<DivinationCase[]>([])

  useEffect(() => {
    let cancelled = false
    repository
      .list()
      .then((all) => {
        if (!cancelled) setRecent(all.slice(0, 3))
      })
      .catch(() => {
        // IndexedDB 不可用时静默展示空态
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="page page--home">
      <h1 className="page__title page__title--brand">问爻</h1>
      <p className="page__subtitle">离线六爻 · 起卦 · 排盘 · 归档</p>

      <div className="home-entries">
        <button type="button" className="entry-card" aria-label="现场摇卦" onClick={() => onNavigate('cast')}>
          <span className="entry-card__title">现场摇卦</span>
          <span className="entry-card__desc">页面摇铜钱，或录入现实投币</span>
        </button>
        <button type="button" className="entry-card" aria-label="手动排盘" onClick={() => onNavigate('manual')}>
          <span className="entry-card__title">手动排盘</span>
          <span className="entry-card__desc">已有卦象，直接录入 6/7/8/9</span>
        </button>
        <button type="button" className="entry-card" aria-label="卦例记录" onClick={() => onNavigate('history')}>
          <span className="entry-card__title">卦例记录</span>
          <span className="entry-card__desc">查看历史卦例与 AI 回答</span>
        </button>
      </div>

      <section className="home-recent" aria-label="最近卦例">
        <h2 className="home-recent__title">最近卦例</h2>
        {recent.length === 0 ? (
          <p className="hint">还没有卦例，先从一次摇卦开始。</p>
        ) : (
          <ul className="home-recent__list">
            {recent.map((value) => (
              <li key={value.id} className="home-recent__item">
                <button type="button" className="home-recent__open" onClick={() => onViewCase(value)}>
                  <span>{value.title || value.question}</span>
                  <span className={`status-chip status-chip--${value.status}`}>{STATUS_LABEL[value.status]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
