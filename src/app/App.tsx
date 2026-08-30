import { useState } from 'react'
import type { DivinationCase } from '../domain/types'
import type { Route } from './navigation'
import { HomePage } from '../features/home/HomePage'
import { CastPage } from '../features/cast/CastPage'
import { ManualPage } from '../features/manual/ManualPage'

function ResultPagePlaceholder({ caseValue, onBack }: { caseValue: DivinationCase; onBack: () => void }) {
  return (
    <section className="page">
      <h1 className="page__title">结果</h1>
      <p className="review-panel__line">{caseValue.question}</p>
      {caseValue.chart ? (
        <>
          <p className="review-panel__line">本卦：{caseValue.chart.original.name}</p>
          {caseValue.chart.changed ? (
            <p className="review-panel__line">变卦：{caseValue.chart.changed.name}</p>
          ) : (
            <p className="review-panel__line">静卦</p>
          )}
        </>
      ) : null}
      <p className="hint">结果卡与提示词将在后续版本完善。</p>
      <button type="button" className="btn" onClick={onBack}>
        返回首页
      </button>
    </section>
  )
}

export default function App() {
  const [route, setRoute] = useState<Route>('home')
  const [activeCase, setActiveCase] = useState<DivinationCase | null>(null)

  const handleCaseCreated = (caseValue: DivinationCase) => {
    setActiveCase(caseValue)
    setRoute('result')
  }

  return (
    <main className="app-shell">
      {route === 'home' ? <HomePage onNavigate={setRoute} /> : null}
      {route === 'cast' ? <CastPage onCaseCreated={handleCaseCreated} /> : null}
      {route === 'manual' ? <ManualPage onCaseCreated={handleCaseCreated} /> : null}
      {route === 'result' && activeCase ? (
        <ResultPagePlaceholder caseValue={activeCase} onBack={() => setRoute('home')} />
      ) : null}
      {route === 'history' ? (
        <section className="page">
          <h1 className="page__title">卦例记录</h1>
          <p className="hint">历史卦例与搜索将在后续版本完善。</p>
          <button type="button" className="btn" onClick={() => setRoute('home')}>
            返回首页
          </button>
        </section>
      ) : null}
    </main>
  )
}
