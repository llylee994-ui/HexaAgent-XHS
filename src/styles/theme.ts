const THEME_KEY = 'wenyao:theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

export type Theme = 'light' | 'dark'

function prefersDark(): boolean {
  return window.matchMedia?.(DARK_QUERY).matches ?? false
}

function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function paint(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  // 容器状态栏底色跟随页面底色，取值对应 tokens.css 的 --paper
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#1a1815' : '#f5f0e8')
}

/** 生效主题：用户手动选择优先，否则跟随系统 */
export function currentTheme(): Theme {
  return storedTheme() ?? (prefersDark() ? 'dark' : 'light')
}

/** 手动切换并持久化，此后不再跟随系统 */
export function setTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    // 存储不可用时仅本次生效
  }
  paint(theme)
}

/** 启动时应用主题；用户未手动选择过时跟随系统变化 */
export function initTheme(): void {
  paint(currentTheme())
  try {
    const query = window.matchMedia?.(DARK_QUERY) as (MediaQueryList & { addListener?(l: () => void): void }) | undefined
    if (!query) return
    const listener = () => {
      if (!storedTheme()) {
        paint(currentTheme())
      }
    }
    // 老 WebView 的 MediaQueryList 只有已废弃的 addListener；两者都没有时放弃跟随系统，
    // 但绝不能因此中断启动（否则整个应用白屏，按钮一个都点不了）
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', listener)
    } else if (typeof query.addListener === 'function') {
      query.addListener(listener)
    }
  } catch {
    // 跟随系统主题属于增益功能，失败时保留首次绘制结果
  }
}
