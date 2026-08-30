import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  HEXAGRAM_CLASSICS,
  getHexagramClassic,
  getRelevantClassicLines,
  isCompleteHexagramClassic,
} from '../../src/content/classics'
import { HEXAGRAM_TABLE } from '../../src/engines/hexagram/table'

describe('经典文本查询', () => {
  it('未知卦名安全返回空结果', () => {
    expect(getHexagramClassic('不存在的卦')).toBeNull()
    expect(getRelevantClassicLines('不存在的卦', [1])).toEqual([])
  })

  it('动爻位置去重并按初爻到上爻返回', () => {
    const lines = getRelevantClassicLines('乾为天', [6, 1, 1])

    expect(lines.map((line) => line.label)).toEqual(['初九', '上九'])
    expect(lines.map((line) => line.position)).toEqual([1, 6])
  })

  it('完整覆盖引擎中的六十四卦和每卦六爻', () => {
    const engineNames = new Set(
      [...HEXAGRAM_TABLE.values()].map((entry) => entry.name),
    )

    expect(HEXAGRAM_CLASSICS).toHaveLength(64)
    expect(HEXAGRAM_CLASSICS.map((item) => item.sequence)).toEqual(
      Array.from({ length: 64 }, (_, index) => index + 1),
    )
    expect(new Set(HEXAGRAM_CLASSICS.map((item) => item.name))).toEqual(
      engineNames,
    )

    for (const item of HEXAGRAM_CLASSICS) {
      expect(item.lines.map((line) => line.position)).toEqual([1, 2, 3, 4, 5, 6])
      expect(item.judgement.original.trim()).not.toBe('')
      expect(item.judgement.plain.trim()).not.toBe('')

      for (const line of item.lines) {
        expect(line.label.trim()).not.toBe('')
        expect(line.original.trim()).not.toBe('')
        expect(line.plain.trim()).not.toBe('')
      }
    }
  })

  it('只为乾坤保留用九与用六', () => {
    expect(getHexagramClassic('乾为天')?.special?.kind).toBe('use-nine')
    expect(getHexagramClassic('坤为地')?.special?.kind).toBe('use-six')

    const otherSpecials = HEXAGRAM_CLASSICS
      .filter((item) => item.name !== '乾为天' && item.name !== '坤为地')
      .filter((item) => item.special !== null)
    expect(otherSpecials).toEqual([])
  })

  it('白话均为独立解释且不含确定性禁语', () => {
    const banned = /保证|必然|注定|绝对|确诊|一定(?:会|能|成功|失败)/
    const categoryBlock = /(?:运势|爱情|事业|财运)[：:]/

    for (const item of HEXAGRAM_CLASSICS) {
      const passages = [item.judgement, ...item.lines]
      if (item.special) passages.push(item.special)

      for (const passage of passages) {
        expect(passage.plain.trim()).not.toBe(passage.original.trim())
        expect(passage.plain).not.toMatch(banned)
        expect(passage.plain).not.toMatch(categoryBlock)
      }
    }
  })

  it('残缺语料不能进入查询映射', () => {
    const malformed = {
      sequence: 1,
      name: '残缺卦',
      judgement: { original: '', plain: '缺少原文' },
      lines: [],
      special: null,
    }

    expect(isCompleteHexagramClassic(malformed)).toBe(false)
  })

  it('锁定已复核原文语料的顺序与内容', () => {
    const canonical = HEXAGRAM_CLASSICS.map((item) => ({
      sequence: item.sequence,
      name: item.name,
      judgement: item.judgement.original,
      lines: item.lines.map((line) => [line.position, line.label, line.original]),
      special: item.special
        ? [item.special.kind, item.special.label, item.special.original]
        : null,
    }))
    const digest = createHash('sha256')
      .update(JSON.stringify(canonical))
      .digest('hex')

    expect(digest).toBe('ebdcf92c9c4e33cfc64ac51ec1d9bd2d7ab65e0e6f3f1c43d8dd0e0109858596')
  })

  it('逐卷边界与关键异文采用已记录的校订', () => {
    const expected = new Map<number, readonly [string, string]>([
      [1, ['乾：元，亨，利，贞。', '亢龙有悔。']],
      [8, ['比：吉。原筮，元永贞，无咎。不宁方来，后夫凶。', '比之无首，凶。']],
      [9, ['小畜：亨。密云不雨，自我西郊。', '既雨既处，尚德载；妇贞厉，月几望；君子征凶。']],
      [16, ['豫：利建侯，行师。', '冥豫，成有渝，无咎。']],
      [24, ['复：亨。出入无疾，朋来无咎。反复其道，七日来复，利有攸往。', '迷复，凶，有灾眚。用行师，终有大败；以其国，君凶，至于十年不克征。']],
      [32, ['恒：亨，无咎，利贞，利有攸往。', '振恒，凶。']],
      [40, ['解：利西南。无所往，其来复吉。有攸往，夙吉。', '公用射隼于高墉之上，获之，无不利。']],
      [48, ['井：改邑不改井，无丧无得，往来井井；汔至，亦未繘井，羸其瓶，凶。', '井收勿幕，有孚元吉。']],
      [49, ['革：己日乃孚，元亨利贞，悔亡。', '君子豹变，小人革面；征凶，居贞吉。']],
      [56, ['旅：小亨，旅贞吉。', '鸟焚其巢，旅人先笑后号啕；丧牛于易，凶。']],
      [57, ['巽：小亨，利有攸往，利见大人。', '巽在床下，丧其资斧，贞凶。']],
      [64, ['未济：亨，小狐汔济，濡其尾，无攸利。', '有孚于饮酒；无咎，濡其首，有孚失是。']],
    ])

    for (const [sequence, [judgement, topLine]] of expected) {
      const item = HEXAGRAM_CLASSICS[sequence - 1]
      expect(item.judgement.original).toBe(judgement)
      expect(item.lines[5].original).toBe(topLine)
    }
    expect(getHexagramClassic('天风姤')?.lines[0].original).toContain('蹢躅')
    expect(getHexagramClassic('风水涣')?.lines[5].original).toBe('涣其血，去逖出，无咎。')
  })
})
