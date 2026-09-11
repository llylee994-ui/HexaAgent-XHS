import { useEffect, useMemo, useState } from 'react'
import type { DivinationCase } from '../../domain/types'
import { interpretCase } from '../../engines/interpretation/engine'
import { isSizhuOverridden } from '../../engines/najia/chart'
import { HeroCard } from './HeroCard'
import { Observations } from './Observations'
import { FullChart } from './FullChart'
import { ReferenceText } from './ReferenceText'
import { PromptPanel } from './PromptPanel'
import { AnswerPanel } from './AnswerPanel'
import { SavePanel } from './SavePanel'
import { PageFrame } from '../../components'
import type { PageFrameBinding } from '../../app/navigation'
import { DETACHED_FRAME } from '../../app/navigation'

export interface ResultPageProps {
  caseValue: DivinationCase
  /** 任何保存动作（提示词、回答、卦例信息）都通过此回调交回父级持久化 */
  onChange(next: DivinationCase): void
  onBack(): void
  onHome?(): void
  frame?: PageFrameBinding
}

/** 结果页：主卡 → 关键观察 → 完整排盘 → 卦爻参考 → 问 AI → 回答回填 → 保存 */
export function ResultPage({ caseValue, onChange, onBack, onHome = onBack, frame = DETACHED_FRAME }: ResultPageProps) {
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(
    caseValue.prompts.at(-1)?.id ?? null,
  )
  const [answerOpen, setAnswerOpen] = useState(false)
  const [disclosureOpen, setDisclosureOpen] = useState(false)

  // 首次进入结果页时补算离线初判并交回父级
  useEffect(() => {
    if (caseValue.chart && caseValue.observations.length === 0) {
      const result = interpretCase(caseValue)
      if (result) {
        onChange({ ...caseValue, observations: [...result.observations] })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summary = useMemo(() => {
    if (caseValue.chart && caseValue.observations.length === 0) {
      return interpretCase(caseValue)?.summary ?? ''
    }
    const supportive = caseValue.observations.filter((o) => o.tendency === 'supportive').length
    const resistant = caseValue.observations.filter((o) => o.tendency === 'resistant').length
    if (supportive > 0 && resistant > 0) {
      return '信号复杂，无法仅凭离线规则形成明确倾向，请结合完整卦象与外部解读综合判断。'
    }
    if (supportive > 0) return '离线规则显示支持性信号较多，整体倾向平稳向好，具体仍需结合卦象整体判断。'
    if (resistant > 0) return '离线规则显示阻力信号较多，建议保持谨慎，等待条件成熟。'
    return '离线规则未发现明显倾向，本结果仅为规则观察记录，仅供参考。'
  }, [caseValue])

  const disclaimers = useMemo(() => interpretCase(caseValue)?.disclaimers ?? [], [caseValue])

  if (!caseValue.chart) {
    return (
      <PageFrame title="结果" canGoBack={frame.canGoBack} direction={frame.direction} onBack={frame.onBack}>
        <section className="page">
          <p className="hint">排盘尚未完成。</p>
        </section>
      </PageFrame>
    )
  }

  return (
    <PageFrame title="排盘结果" canGoBack={frame.canGoBack} direction={frame.direction} onBack={frame.onBack}>
    <section className="page">
      {caseValue.answers.length === 0 ? (
        <p className="hint hint--warning result-page__reminder">这条卦例还没有保存 AI 解读</p>
      ) : null}

      <HeroCard caseValue={caseValue} summary={summary} disclaimers={disclaimers} />
      <Observations caseValue={caseValue} />

      {disclosureOpen ? (
        <>
          <FullChart chart={caseValue.chart} sizhuOverridden={isSizhuOverridden(caseValue.castAt, caseValue.chart, caseValue.timeZone)} />
          <ReferenceText chart={caseValue.chart} />
        </>
      ) : null}
      <button type="button" className="btn" aria-expanded={disclosureOpen} onClick={() => setDisclosureOpen((open) => !open)}>
        {disclosureOpen ? '收起完整排盘' : '展开完整排盘'}
      </button>

      <PromptPanel
        caseValue={caseValue}
        selectedPromptId={selectedPromptId}
        onSelectPrompt={setSelectedPromptId}
        onChange={onChange}
        onOpenAnswer={() => setAnswerOpen(true)}
      />
      <AnswerPanel
        caseValue={caseValue}
        promptId={selectedPromptId}
        open={answerOpen}
        onChange={onChange}
      />
      <SavePanel caseValue={caseValue} onChange={onChange} />

      <button type="button" className="btn" onClick={onHome}>返回首页</button>
    </section>
    </PageFrame>
  )
}
