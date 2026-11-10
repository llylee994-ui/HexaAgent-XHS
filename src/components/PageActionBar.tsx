import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface PageActionBarProps {
  secondary?: ReactNode
  primary: ReactNode
  hint?: string
  hintTone?: 'default' | 'warning'
}

/**
 * 页面级固定操作栏：只负责"始终可见"的呈现，不承载任何业务逻辑。
 *
 * 之所以 portal 到 body：页面过渡动画会在 `.page-frame__body` 上保留一个
 * `transform: translateX(0)`，带 transform 的祖先会成为 fixed 子元素的包含块，
 * 固定栏就会跟着内容一起滚动。挂到 body 上才真正相对视口固定。
 * 占位块仍留在页面流里，补上被固定栏盖住的高度。
 */
export function PageActionBar({ secondary, primary, hint, hintTone = 'default' }: PageActionBarProps) {
  return (
    <>
      <div className="page-action-bar__spacer" aria-hidden="true" />
      {createPortal(
        <aside
          className="page-action-bar"
          role="region"
          aria-label="页面操作"
          data-single={!secondary || undefined}
        >
          <div className="page-action-bar__row">
            {secondary}
            {primary}
          </div>
          {hint ? (
            <p className={`page-action-bar__hint${hintTone === 'warning' ? ' page-action-bar__hint--warning' : ''}`}>
              {hint}
            </p>
          ) : null}
        </aside>,
        document.body,
      )}
    </>
  )
}
