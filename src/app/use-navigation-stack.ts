import { useCallback, useEffect, useRef, useState } from 'react'
import type { NavigationDirection, NavigationEntry, Route } from './navigation'

export interface NavigationStack {
  current: NavigationEntry
  direction: NavigationDirection
  canGoBack: boolean
  push(entry: Omit<NavigationEntry, 'key'>): void
  updateCurrent(patch: Partial<NavigationEntry>): void
  back(): void
  resetToHome(): void
}

interface BrowserState {
  wenYaoIndex?: number
  historyView?: { query: string; scrollY: number }
}

const HOME_ENTRY: NavigationEntry = {
  key: 'home',
  route: 'home',
  scrollY: 0,
}

function popStack(stack: readonly NavigationEntry[]): NavigationEntry[] {
  return stack.length > 1 ? stack.slice(0, -1) : [...stack]
}

let keyCounter = 0
function createKey(prefix: string): string {
  keyCounter += 1
  return `${prefix}-${keyCounter}`
}

/**
 * 应用内导航栈：首页常驻栈底，push 压入新页并同步一条浏览器历史记录。
 * 应用内 back 与浏览器 popstate 走同一个内部弹出函数；pendingInAppBacks 计数器
 * 保证应用内返回触发的 popstate 不会再次弹出。栈内只保存页面恢复所需的临时状态。
 */
export function useNavigationStack(initialRoute: Route = 'home'): NavigationStack {
  const [entries, setEntries] = useState<NavigationEntry[]>(() => [
    { ...HOME_ENTRY, route: initialRoute },
  ])
  const [direction, setDirection] = useState<NavigationDirection>('forward')
  const pendingInAppBacks = useRef(0)
  const depthRef = useRef(1)

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      if (pendingInAppBacks.current > 0) {
        pendingInAppBacks.current -= 1
        return
      }
      const state = event.state as BrowserState | null
      if (state?.wenYaoIndex === depthRef.current) {
        setDirection('back')
        return
      }
      depthRef.current = Math.max(1, depthRef.current - 1)
      setDirection('back')
      setEntries((prev) => popStack(prev))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const push = useCallback((entry: Omit<NavigationEntry, 'key'>) => {
    setDirection('forward')
    depthRef.current += 1
    history.pushState({ wenYaoIndex: depthRef.current } satisfies BrowserState, '')
    setEntries((prev) => [...prev, { ...entry, key: createKey(entry.route) }])
  }, [])

  const updateCurrent = useCallback((patch: Partial<NavigationEntry>) => {
    setEntries((prev) => {
      if (prev.length === 0) return prev
      const current = prev[prev.length - 1]
      return [...prev.slice(0, -1), { ...current, ...patch }]
    })
  }, [])

  const back = useCallback(() => {
    if (depthRef.current <= 1) return
    pendingInAppBacks.current += 1
    depthRef.current -= 1
    history.back()
    setDirection('back')
    setEntries((prev) => popStack(prev))
  }, [])

  const resetToHome = useCallback(() => {
    setDirection('back')
    depthRef.current = 1
    pendingInAppBacks.current = 0
    history.replaceState({ wenYaoIndex: 1 } satisfies BrowserState, '')
    setEntries([{ ...HOME_ENTRY }])
  }, [])

  const current = entries[entries.length - 1] ?? { ...HOME_ENTRY }

  return {
    current,
    direction,
    canGoBack: entries.length > 1,
    push,
    updateCurrent,
    back,
    resetToHome,
  }
}
