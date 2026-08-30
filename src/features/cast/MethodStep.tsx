import type { CastMethod } from '../../domain/types'

export interface MethodStepProps {
  onSelect(method: CastMethod): void
}

/** 现场摇卦的第二步：选择起卦方式 */
export function MethodStep({ onSelect }: MethodStepProps) {
  return (
    <div className="method-step">
      <button
        type="button"
        className="entry-card"
        aria-label="模拟铜钱摇卦"
        onClick={() => onSelect('simulated-coins')}
      >
        <span className="entry-card__title">模拟铜钱摇卦</span>
        <span className="entry-card__desc">在页面中摇动三枚铜钱，共六轮</span>
      </button>
      <button
        type="button"
        className="entry-card"
        aria-label="现实投币录入"
        onClick={() => onSelect('physical-coins')}
      >
        <span className="entry-card__title">现实投币录入</span>
        <span className="entry-card__desc">投现实硬币，逐轮记录正反面</span>
      </button>
    </div>
  )
}
