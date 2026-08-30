import type { LinePosition } from '../../domain/types'
import type { HexagramClassicText } from './types'

export type {
  ClassicLine,
  ClassicPassage,
  ClassicSpecial,
  HexagramClassicText,
} from './types'

const QIAN: HexagramClassicText = {
  sequence: 1,
  name: '乾为天',
  judgement: {
    original: '乾：元，亨，利，贞。',
    plain: '乾卦象征刚健运行。事情具备开端、通达、适宜和守正的条件，但四者需要贯穿始终。',
  },
  lines: [
    { position: 1, label: '初九', original: '潜龙，勿用。', plain: '力量尚在潜藏阶段，不宜急着施展；先积累条件，等待合适时机。' },
    { position: 2, label: '九二', original: '见龙在田，利见大人。', plain: '才干开始显露并进入实际环境，适合接触有见识、有担当的人，获得指引或合作。' },
    { position: 3, label: '九三', original: '君子终日乾乾，夕惕若，厉，无咎。', plain: '处在上升而未稳的位置，应整日自强，夜间仍保持警惕；虽然有压力，谨慎便可避免过失。' },
    { position: 4, label: '九四', original: '或跃在渊，无咎。', plain: '正面临进退转换，可以尝试跃升，也可以暂留原位；审时而动，便没有过失。' },
    { position: 5, label: '九五', original: '飞龙在天，利见大人。', plain: '能力与位置相称，可以充分发挥影响力；仍适合与德才兼备的人相互成就。' },
    { position: 6, label: '上九', original: '亢龙有悔。', plain: '上升到了过高的位置，继续逞强容易失去回旋余地；应懂得收敛和退让。' },
  ],
  special: {
    kind: 'use-nine',
    label: '用九',
    original: '见群龙无首，吉。',
    plain: '群体各自发挥刚健力量而不争夺首领位置，彼此协作、不过度居先，较为有利。',
  },
}

export const HEXAGRAM_CLASSICS: readonly HexagramClassicText[] = [QIAN]

const CLASSICS_BY_NAME = new Map<string, HexagramClassicText>()
for (const item of HEXAGRAM_CLASSICS) {
  if (CLASSICS_BY_NAME.has(item.name)) {
    throw new Error(`经典文本卦名重复：${item.name}`)
  }
  CLASSICS_BY_NAME.set(item.name, item)
}

export function getHexagramClassic(name: string): HexagramClassicText | null {
  return CLASSICS_BY_NAME.get(name) ?? null
}

export function getRelevantClassicLines(
  name: string,
  positions: readonly LinePosition[],
) {
  const classic = getHexagramClassic(name)
  if (!classic) return []

  const selected = new Set(positions)
  return classic.lines.filter((line) => selected.has(line.position))
}
