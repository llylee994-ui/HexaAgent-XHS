import type { DivinationCase } from '../../domain/types'

export interface ObservationsProps {
  caseValue: DivinationCase
}

const TENDENCY_LABEL: Record<string, string> = {
  supportive: '支持',
  resistant: '阻力',
  mixed: '复杂',
  neutral: '中性',
}

/** 关键观察：每条初判的观察、依据与倾向，可由 ruleId 回溯 */
export function Observations({ caseValue }: ObservationsProps) {
  if (caseValue.observations.length === 0) return null
  return (
    <section className="observations" aria-label="关键观察">
      <h2 className="section-title">关键观察</h2>
      <ul className="observations__list">
        {caseValue.observations.map((item) => (
          <li key={`${item.ruleId}-${item.linePositions.join(',')}-${item.observation}`} className="observations__item">
            <p className="observations__text">{item.observation}</p>
            <p className="observations__basis">依据：{item.basis}</p>
            <p className={`observations__tendency observations__tendency--${item.tendency}`}>
              倾向：{TENDENCY_LABEL[item.tendency]}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
