import type { LinePosition } from '../../../domain/types'
import type {
  ClassicSpecial,
  HexagramClassicText,
} from '../types'

type LineSeed = readonly [label: string, original: string, plain: string]
type SpecialSeed = readonly [
  kind: ClassicSpecial['kind'],
  label: string,
  original: string,
  plain: string,
]

export function defineHexagram(
  sequence: number,
  name: string,
  judgementOriginal: string,
  judgementPlain: string,
  lines: readonly [LineSeed, LineSeed, LineSeed, LineSeed, LineSeed, LineSeed],
  specialSeed?: SpecialSeed,
): HexagramClassicText {
  const line = (position: LinePosition, seed: LineSeed) => ({
    position,
    label: seed[0],
    original: seed[1],
    plain: seed[2],
  })
  const mappedLines: HexagramClassicText['lines'] = [
    line(1, lines[0]),
    line(2, lines[1]),
    line(3, lines[2]),
    line(4, lines[3]),
    line(5, lines[4]),
    line(6, lines[5]),
  ]

  const special = specialSeed
    ? {
        kind: specialSeed[0],
        label: specialSeed[1],
        original: specialSeed[2],
        plain: specialSeed[3],
      }
    : null

  return {
    sequence,
    name,
    judgement: { original: judgementOriginal, plain: judgementPlain },
    lines: mappedLines,
    special,
  }
}
