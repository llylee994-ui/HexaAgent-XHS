import type { ReactNode } from 'react'
import type { NavigationDirection } from '../app/navigation'

export interface PageFrameProps {
  title: string
  canGoBack?: boolean
  direction?: NavigationDirection
  status?: string
  onBack?(): void
  children: ReactNode
}

/** 统一页面框架：顶部栏（返回 / 标题 / 状态区）与页面过渡容器 */
export function PageFrame({ title, canGoBack = false, direction = 'forward', status, onBack, children }: PageFrameProps) {
  return (
    <div className="page-frame" data-direction={direction}>
      <header className="page-frame__topbar">
        {canGoBack && onBack ? (
          <button type="button" className="btn btn--small page-frame__back" aria-label="返回" onClick={onBack}>
            返回
          </button>
        ) : (
          <span className="page-frame__spacer" aria-hidden="true" />
        )}
        <h1 className="page-frame__title">{title}</h1>
        <span className="page-frame__status">{status ?? ''}</span>
      </header>
      <div className="page-frame__body">{children}</div>
    </div>
  )
}
