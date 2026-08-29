import type { LinePosition } from '../../domain/types'

export type ShiYingMark = 'shi' | 'ying' | null

/** 世爻位置 → 六爻世应标记；应爻与世爻隔三爻 */
export function shiyingPositions(shiPosition: LinePosition): Record<LinePosition, ShiYingMark> {
  const yingPosition = (((shiPosition + 2) % 6) + 1) as LinePosition
  const result = {} as Record<LinePosition, ShiYingMark>
  for (let pos = 1; pos <= 6; pos++) {
    const p = pos as LinePosition
    result[p] = p === shiPosition ? 'shi' : p === yingPosition ? 'ying' : null
  }
  return result
}
