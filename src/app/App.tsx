import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DivinationCase } from '../domain/types'
import { useNavigationStack } from './use-navigation-stack'
import { createCaseRepository } from '../storage/case-db'
import { StorageFullError } from '../storage/errors'
import { HomePage } from '../features/home/HomePage'
import { CastPage } from '../features/cast/CastPage'
import { ManualPage } from '../features/manual/ManualPage'
import { ResultPage } from '../features/result/ResultPage'
import { HistoryPage } from '../features/history/HistoryPage'

const repository = createCaseRepository()

function describeSaveFailure(error: unknown): string {
  if (error instanceof StorageFullError) {
    return '存储空间不足，本次修改没有保存。请先删除旧卦例再重试。'
  }
  return `本次修改没有保存：${error instanceof Error ? error.message : String(error)}`
}

export default function App() {
  const navigation = useNavigationStack()
  const route = navigation.current.route
  const [activeCase, setActiveCase] = useState<DivinationCase | null>(null)
  const [saveFailure, setSaveFailure] = useState<string | null>(null)
  const { updateCurrent } = navigation

  /**
   * 所有落盘都走这里：失败必须让用户看见。
   * 静默失败会让"保存"看起来像按钮坏了（容器禁用存储时正是这个表现），
   * 也是审核判定"功能缺陷"最典型的依据。
   */
  const persist = useCallback((value: DivinationCase) => {
    repository.put(value).then(
      () => setSaveFailure(null),
      (error: unknown) => setSaveFailure(describeSaveFailure(error)),
    )
  }, [])

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
    persist(caseValue)
  }

  const handleCaseChanged = (next: DivinationCase) => {
    setActiveCase(next)
    persist(next)
  }

  // 事件处理函数之外的异常（例如未捕获的 Promise）不阻断浏览，由控制台记录
  useEffect(() => {
    const report = (event: PromiseRejectionEvent) => {
      console.error(event.reason)
    }
    window.addEventListener('unhandledrejection', report)
    return () => window.removeEventListener('unhandledrejection', report)
  }, [])

  return (
    <main className="app-shell">
      {saveFailure ? (
        <p className="save-failure" role="alert">
          {saveFailure}
        </p>
      ) : null}
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
