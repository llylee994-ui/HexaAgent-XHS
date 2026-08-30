import type { DivinationCase } from '../../domain/types'
import { Disclaimer, HexagramLines } from '../../components'
import { formatMethod } from '../../engines/prompt/formatter'

export interface HeroCardProps {
  caseValue: DivinationCase
  summary: string
  disclaimers: readonly string[]
}

/** 首屏竖版卡：问题、起卦信息、本变关系、六爻、趋势摘要与免责声明 */
export function HeroCard({ caseValue, summary, disclaimers }: HeroCardProps) {
  const chart = caseValue.chart
  if (!chart) return null

  return (
    <section className="hero-card" aria-label="卦象主卡">
      <p className="hero-card__question">{caseValue.question}</p>
      <p className="hero-card__meta">
        {caseValue.castAt.slice(0, 16).replace('T', ' ')} · {formatMethod(caseValue.method)}
      </p>
      <div className="hero-card__relation">
        <p className="review-panel__line">本卦：{chart.original.name}</p>
        {chart.changed ? (
          <p className="review-panel__line">变卦：{chart.changed.name}</p>
        ) : (
          <p className="review-panel__line">静卦</p>
        )}
      </div>
      <HexagramLines figure={chart.original} changingLines={chart.changingLines} />
      <p className="hero-card__summary">{summary}</p>
      <Disclaimer items={disclaimers} />
    </section>
  )
}
