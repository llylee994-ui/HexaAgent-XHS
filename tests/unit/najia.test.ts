import { describe, expect, it } from 'vitest'
import { TRIGRAM_NAZHI, getHexagramNazhi } from '../../src/engines/najia/nazhi'
import { getLiuqin } from '../../src/engines/najia/liuqin'
import { getLiushenByDayGan } from '../../src/engines/najia/liushen'
import { shiyingPositions } from '../../src/engines/najia/shiying'

describe('纳甲（八卦内外卦纳支）', () => {
  it('乾卦：内卦甲子甲寅甲辰，外卦壬午壬申壬戌', () => {
    expect(getHexagramNazhi('乾', '乾')).toEqual([
      ['甲', '子'], ['甲', '寅'], ['甲', '辰'],
      ['壬', '午'], ['壬', '申'], ['壬', '戌'],
    ])
  })

  it('天风姤为乾上巽下：初二三爻用巽内卦，四五上爻用乾外卦', () => {
    expect(getHexagramNazhi('乾', '巽')).toEqual([
      ['辛', '丑'], ['辛', '亥'], ['辛', '酉'],
      ['壬', '午'], ['壬', '申'], ['壬', '戌'],
    ])
  })

  it('八个三画卦的纳支表完整', () => {
    for (const [name, data] of Object.entries(TRIGRAM_NAZHI)) {
      expect(data.inner, name).toHaveLength(3)
      expect(data.outer, name).toHaveLength(3)
    }
    expect(Object.keys(TRIGRAM_NAZHI)).toHaveLength(8)
  })
})

describe('六亲（卦宫五行与爻支五行关系）', () => {
  // 卦宫为金：同我兄弟、我生子孙、生我父母、我克妻财、克我官鬼
  it('金宫五种五行关系', () => {
    expect(getLiuqin('金', '酉')).toBe('兄弟') // 同为金
    expect(getLiuqin('金', '亥')).toBe('子孙') // 金生水
    expect(getLiuqin('金', '辰')).toBe('父母') // 土生金
    expect(getLiuqin('金', '寅')).toBe('妻财') // 金克木
    expect(getLiuqin('金', '午')).toBe('官鬼') // 火克金
  })

  it('土宫：水为妻财（土克水）', () => {
    expect(getLiuqin('土', '子')).toBe('妻财')
  })
})

describe('六神（日干起位）', () => {
  it('十日干对应初爻六神起位', () => {
    expect(getLiushenByDayGan('甲')[0]).toBe('青龙')
    expect(getLiushenByDayGan('乙')[0]).toBe('青龙')
    expect(getLiushenByDayGan('丙')[0]).toBe('朱雀')
    expect(getLiushenByDayGan('丁')[0]).toBe('朱雀')
    expect(getLiushenByDayGan('戊')[0]).toBe('勾陈')
    expect(getLiushenByDayGan('己')[0]).toBe('腾蛇')
    expect(getLiushenByDayGan('庚')[0]).toBe('白虎')
    expect(getLiushenByDayGan('辛')[0]).toBe('白虎')
    expect(getLiushenByDayGan('壬')[0]).toBe('玄武')
    expect(getLiushenByDayGan('癸')[0]).toBe('玄武')
  })

  it('甲日六爻从青龙依序排布', () => {
    expect(getLiushenByDayGan('甲')).toEqual([
      '青龙', '朱雀', '勾陈', '腾蛇', '白虎', '玄武',
    ])
  })
})

describe('世应（隔三爻）', () => {
  it('世位 1..6 对应应位 4,5,6,1,2,3', () => {
    const expectedYing = [4, 5, 6, 1, 2, 3]
    for (let shi = 1; shi <= 6; shi++) {
      const positions = shiyingPositions(shi as 1 | 2 | 3 | 4 | 5 | 6)
      expect(positions[shi]).toBe('shi')
      expect(positions[expectedYing[shi - 1]]).toBe('ying')
      const marked = Object.values(positions).filter((v) => v !== null)
      expect(marked).toHaveLength(2)
    }
  })
})
