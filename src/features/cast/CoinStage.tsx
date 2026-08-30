import { useState } from 'react'
import { Coin } from '../../components'
import { throwCoins } from '../../engines/divination/coins'

export interface CoinStageProps {
  onThrow(faces: readonly [0 | 1, 0 | 1, 0 | 1]): void
}

/** 模拟三枚铜钱：点击摇动完成一次投币，CSS 动画表现翻转 */
export function CoinStage({ onThrow }: CoinStageProps) {
  const [faces, setFaces] = useState<readonly [0 | 1, 0 | 1, 0 | 1]>([0, 0, 0])

  return (
    <div className="coin-stage">
      <div className="coin-stage__coins">
        <Coin face={faces[0]} label="第一枚铜钱" />
        <Coin face={faces[1]} label="第二枚铜钱" />
        <Coin face={faces[2]} label="第三枚铜钱" />
      </div>
      <button
        type="button"
        className="btn btn--primary"
        onClick={() => {
          const next = throwCoins()
          setFaces(next)
          onThrow(next)
        }}
      >
        摇动铜钱
      </button>
    </div>
  )
}
