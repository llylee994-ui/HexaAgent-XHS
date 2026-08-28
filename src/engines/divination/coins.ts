import type { CoinThrow, RawYaoValue, YinYang } from '../../domain/types'

/** 单枚铜钱爻面：1 为正面（记 3），0 为反面（记 2） */
export type CoinFace = 0 | 1
export type CoinFaces = readonly [CoinFace, CoinFace, CoinFace]

/** 三枚铜钱爻面 → 原始爻值：正面记 3、反面记 2，三枚之和为 6..9 */
export function facesToRawValue(faces: CoinFaces): RawYaoValue {
  const sum = faces[0] + faces[1] + faces[2]
  return (sum + 6) as RawYaoValue
}

/** 原始爻值 → 阴阳与动静：6 老阴动、7 少阳静、8 少阴静、9 老阳动 */
export function rawValueToLine(rawValue: RawYaoValue): { type: YinYang; changing: boolean } {
  switch (rawValue) {
    case 6:
      return { type: 'yin', changing: true }
    case 7:
      return { type: 'yang', changing: false }
    case 8:
      return { type: 'yin', changing: false }
    case 9:
      return { type: 'yang', changing: true }
    default:
      throw new Error(`非法爻值: ${rawValue satisfies never}`)
  }
}

/** 单轮投币：每次 random() 决定一枚铜钱，< 0.5 为正面 */
export function throwCoins(random: () => number = Math.random): CoinFaces {
  const faces = [0, 1, 2].map<CoinFace>(() => (random() < 0.5 ? 1 : 0))
  return [faces[0], faces[1], faces[2]]
}

/** 六轮投币，按初爻到上爻顺序生成完整 CoinThrow 列表 */
export function throwAllRounds(random: () => number = Math.random): CoinThrow[] {
  return [1, 2, 3, 4, 5, 6].map((round) => {
    const faces = throwCoins(random)
    return { round, faces, rawValue: facesToRawValue(faces) } as CoinThrow
  })
}
