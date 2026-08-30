import { useEffect, useState } from 'react'
import type { DivinationCase } from '../domain/types'
import type { Route } from './navigation'
import { createCaseRepository } from '../storage/case-db'
import { HomePage } from '../features/home/HomePage'
import { CastPage } from '../features/cast/CastPage'
import { ManualPage } from '../features/manual/ManualPage'
import { ResultPage } from '../features/result/ResultPage'
import { HistoryPage } from '../features/history/HistoryPage'

const repository = createCaseRepository()

export default function App() {
  const [route, setRoute] = useState<Route>('home')
  const [activeCase, setActiveCase] = useState<DivinationCase | null>(null)

  const handleCaseCreated = (caseValue: DivinationCase) => {
    setActiveCase(caseValue)
    setRoute('result')
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
          onNavigate={setRoute}
          onViewCase={(caseValue) => {
            setActiveCase(caseValue)
            setRoute('result')
          }}
        />
      ) : null}
      {route === 'cast' ? <CastPage onCaseCreated={handleCaseCreated} /> : null}
      {route === 'manual' ? <ManualPage onCaseCreated={handleCaseCreated} /> : null}
      {route === 'result' && activeCase ? (
        <ResultPage
          caseValue={activeCase}
          onChange={handleCaseChanged}
          onBack={() => setRoute('home')}
        />
      ) : null}
      {route === 'history' ? (
        <HistoryPage
          onView={(caseValue) => {
            setActiveCase(caseValue)
            setRoute('result')
          }}
          onBack={() => setRoute('home')}
        />
      ) : null}
    </main>
  )
}
