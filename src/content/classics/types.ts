import type { LinePosition } from '../../domain/types'

export interface ClassicPassage {
  readonly original: string
  readonly plain: string
}

export interface ClassicLine extends ClassicPassage {
  readonly position: LinePosition
  readonly label: string
}

export interface ClassicSpecial extends ClassicPassage {
  readonly kind: 'use-nine' | 'use-six'
  readonly label: string
}

export interface HexagramClassicText {
  readonly sequence: number
  readonly name: string
  readonly judgement: ClassicPassage
  readonly lines: readonly [
    ClassicLine,
    ClassicLine,
    ClassicLine,
    ClassicLine,
    ClassicLine,
    ClassicLine,
  ]
  readonly special: ClassicSpecial | null
}
