import { Coin } from '../../components'
import type { CoinFaces } from '../../engines/divination/coins'

const COIN_LABELS = ['第一枚铜钱', '第二枚铜钱', '第三枚铜钱'] as const

export interface PhysicalCoinStageProps {
  faces: CoinFaces
  onFlip(index: 0 | 1 | 2): void
}

/**
 * 现实投币录入：只展示受控铜钱面并负责正反面切换。
 * 「确认本轮」由页面放进固定操作栏，这里不再自带主按钮。
 */
export function PhysicalCoinStage({ faces, onFlip }: PhysicalCoinStageProps) {
  return (
    <div className="coin-stage">
      <div className="coin-stage__coins">
        {COIN_LABELS.map((label, index) => (
          <Coin key={label} face={faces[index]} label={label} onFlip={() => onFlip(index as 0 | 1 | 2)} />
        ))}
      </div>
    </div>
  )
}
