import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DivinationCase } from '../domain/types'
import { useNavigationStack } from './use-navigation-stack'
import { createCaseRepository } from '../storage/case-db'
import { HomePage } from '../features/home/HomePage'
import { CastPage } from '../features/cast/CastPage'
import { ManualPage } from '../features/manual/ManualPage'
import { ResultPage } from '../features/result/ResultPage'
import { HistoryPage } from '../features/history/HistoryPage'

const repository = createCaseRepository()

export default function App() {
  const navigation = useNavigationStack()
  const route = navigation.current.route
  const [activeCase, setActiveCase] = useState<DivinationCase | null>(null)
  const { updateCurrent } = navigation

  const frame = useMemo(
    () => ({
      canGoBack: navigation.canGoBack,
      direction: navigation.direction,
      onBack: navigation.back,
    }),
    [navigation.canGoBack, navigation.direction, navigation.back],
  )

  const handleHistoryViewStateChange = useCallback(
    (state: { query: string; scrollY: number }) => {
      updateCurrent({ history: state, scrollY: state.scrollY })
    },
    [updateCurrent],
  )

  const handleCaseCreated = (caseValue: DivinationCase) => {
    setActiveCase(caseValue)
    navigation.push({ route: 'result', activeCaseId: caseValue.id, scrollY: 0 })
    void repository.put(caseValue)
  }

  const handleCaseChanged = (next: DivinationCase) => {
    setActiveCase(next)
    void repository.put(next)
  }

  // 低存储等异常不阻断浏览，由控制台记录；发布前由 e2e 覆盖
  useEffect(() => {
    const report = (event: PromiseRejectionEvent) => {
      console.error(event.reason)
    }
    window.addEventListener('unhandledrejection', report)
    return () => window.removeEventListener('unhandledrejection', report)
  }, [])

  return (
    <main className="app-shell">
      {route === 'home' ? (
        <HomePage
          onNavigate={(nextRoute) => navigation.push({ route: nextRoute, scrollY: 0 })}
          onViewCase={(caseValue) => {
            setActiveCase(caseValue)
            navigation.push({ route: 'result', activeCaseId: caseValue.id, scrollY: 0 })
          }}
        />
      ) : null}
      {route === 'cast' ? <CastPage onCaseCreated={handleCaseCreated} frame={frame} /> : null}
      {route === 'manual' ? <ManualPage onCaseCreated={handleCaseCreated} frame={frame} /> : null}
      {route === 'result' && activeCase ? (
        <ResultPage
          caseValue={activeCase}
          onChange={handleCaseChanged}
          onBack={navigation.back}
          onHome={navigation.resetToHome}
          frame={frame}
        />
      ) : null}
      {route === 'history' ? (
        <HistoryPage
          initialQuery={navigation.current.history?.query ?? ''}
          initialScrollY={navigation.current.history?.scrollY ?? 0}
          onViewStateChange={handleHistoryViewStateChange}
          onView={(caseValue) => {
            setActiveCase(caseValue)
            navigation.updateCurrent({ history: { query: navigation.current.history?.query ?? '', scrollY: window.scrollY }, scrollY: window.scrollY })
            navigation.push({ route: 'result', activeCaseId: caseValue.id, scrollY: 0 })
          }}
          onBack={navigation.back}
          frame={frame}
        />
      ) : null}
    </main>
  )
}
