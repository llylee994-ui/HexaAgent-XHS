export type Route = 'home' | 'cast' | 'manual' | 'result' | 'history'
export type NavigationDirection = 'forward' | 'back'

export interface HistoryViewState {
  query: string
  scrollY: number
}

export interface NavigationEntry {
  key: string
  route: Route
  activeCaseId?: string
  history?: HistoryViewState
  scrollY: number
}

/** 页面接入统一返回栏所需的导航绑定，由 App 从导航栈派生 */
export interface PageFrameBinding {
  canGoBack: boolean
  direction: NavigationDirection
  onBack(): void
}

export const DETACHED_FRAME: PageFrameBinding = {
  canGoBack: false,
  direction: 'forward',
  onBack() {},
}
