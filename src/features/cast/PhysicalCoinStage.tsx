import { useState } from 'react'
import { Coin } from '../../components'

const COIN_LABELS = ['第一枚铜钱', '第二枚铜钱', '第三枚铜钱'] as const

export interface PhysicalCoinStageProps {
  onConfirm(faces: readonly [0 | 1, 0 | 1, 0 | 1]): void
}

/** 现实投币录入：每轮切换三枚硬币的正反面后确认 */
export function PhysicalCoinStage({ onConfirm }: PhysicalCoinStageProps) {
  const [faces, setFaces] = useState<readonly [0 | 1, 0 | 1, 0 | 1]>([0, 0, 0])

  const flip = (index: 0 | 1 | 2) => {
    setFaces((prev) => {
      const next = [...prev] as [0 | 1, 0 | 1, 0 | 1]
      next[index] = prev[index] === 1 ? 0 : 1
      return next
    })
  }

  return (
    <div className="coin-stage">
      <div className="coin-stage__coins">
        {COIN_LABELS.map((label, index) => (
          <Coin key={label} face={faces[index]} label={label} onFlip={() => flip(index as 0 | 1 | 2)} />
        ))}
      </div>
      <button
        type="button"
        className="btn btn--primary"
        onClick={() => {
          onConfirm(faces)
          setFaces([0, 0, 0])
        }}
      >
        确认本轮
      </button>
    </div>
  )
}
