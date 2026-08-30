import type { LinePosition } from '../../domain/types'

export interface ClassicPassage {
  original: string
  plain: string
}

export interface ClassicLine extends ClassicPassage {
  position: LinePosition
  label: string
}

export interface ClassicSpecial extends ClassicPassage {
  kind: 'use-nine' | 'use-six'
  label: string
}

export interface HexagramClassicText {
  sequence: number
  name: string
  judgement: ClassicPassage
  lines: readonly [
    ClassicLine,
    ClassicLine,
    ClassicLine,
    ClassicLine,
    ClassicLine,
    ClassicLine,
  ]
  special: ClassicSpecial | null
}
