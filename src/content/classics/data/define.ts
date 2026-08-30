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
  const mappedLines = lines.map(([label, original, plain], index) => ({
    position: (index + 1) as LinePosition,
    label,
    original,
    plain,
  })) as unknown as HexagramClassicText['lines']

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
