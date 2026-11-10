import { useEffect, useState } from 'react'
import type { DivinationCase } from '../../domain/types'
import { createCaseRepository, type CaseRepository } from '../../storage/case-db'
import { currentTheme, setTheme, type Theme } from '../../styles/theme'
import { STATUS_LABEL } from '../history/status'

const defaultRepository = createCaseRepository()

export interface HomePageProps {
  repository?: CaseRepository
  onNavigate(route: 'cast' | 'manual' | 'history'): void
  onViewCase(caseValue: DivinationCase): void
}

/** 首页：两个主入口卡 + 卦例记录入口 + 最近三条卦例 */
export function HomePage({ repository = defaultRepository, onNavigate, onViewCase }: HomePageProps) {
  const [recent, setRecent] = useState<DivinationCase[]>([])
  const [recentStatus, setRecentStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [theme, setThemeState] = useState<Theme>(() => currentTheme())

  const handleToggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  useEffect(() => {
    let cancelled = false
    repository
      .list()
      .then((all) => {
        if (!cancelled) {
          setRecent(all.slice(0, 3))
          setRecentStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setRecentStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [repository])

  return (
    <section className="page page--home">
      <h1 className="page__title page__title--brand">问爻</h1>
      <p className="page__subtitle">离线六爻 · 起卦 · 排盘 · 归档</p>

      <div className="home-toolbar">
        <button
          type="button"
          className="theme-toggle"
          aria-label="夜间模式"
          aria-pressed={theme === 'dark'}
          onClick={handleToggleTheme}
        >
          <svg className="theme-toggle__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
      </div>

      <div className="home-entries">
        <button type="button" className="entry-card" aria-label="现场摇卦" onClick={() => onNavigate('cast')}>
          <span className="entry-card__title">现场摇卦</span>
          <span className="entry-card__desc">页面摇铜钱，或录入现实投币</span>
        </button>
        <button type="button" className="entry-card" aria-label="手动排盘" onClick={() => onNavigate('manual')}>
          <span className="entry-card__title">手动排盘</span>
          <span className="entry-card__desc">已有卦象，自动排盘后可校正</span>
        </button>
        <button type="button" className="entry-card" aria-label="卦例记录" onClick={() => onNavigate('history')}>
          <span className="entry-card__title">卦例记录</span>
          <span className="entry-card__desc">查看历史卦例与 AI 回答</span>
        </button>
      </div>

      <section className="home-recent" aria-label="最近卦例">
        <h2 className="home-recent__title">最近卦例</h2>
        {recentStatus === 'loading' ? (
          <p className="hint" role="status" aria-live="polite">正在加载最近卦例…</p>
        ) : recentStatus === 'error' ? (
          <p className="hint hint--warning">最近卦例加载失败，请稍后重试。</p>
        ) : recent.length === 0 ? (
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
