import { Coin } from '../../components'
import type { CoinFaces } from '../../engines/divination/coins'

export interface CoinStageProps {
  faces: CoinFaces
}

/**
 * 模拟三枚铜钱：只展示由页面控制的本轮铜钱面。
 * 页面把「摇动铜钱」放进固定操作栏，这里不再自带主按钮，避免出现两个入口。
 */
export function CoinStage({ faces }: CoinStageProps) {
  return (
    <div className="coin-stage">
      <div className="coin-stage__coins">
        <Coin face={faces[0]} label="第一枚铜钱" />
        <Coin face={faces[1]} label="第二枚铜钱" />
        <Coin face={faces[2]} label="第三枚铜钱" />
      </div>
    </div>
  )
}
