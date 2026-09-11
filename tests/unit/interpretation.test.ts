import { describe, expect, it } from 'vitest'
import type { QuestionCategory } from '../../src/domain/types'
import { FIXED_HEXAGRAM_CASES } from '../fixtures/hexagram-cases'
import { buildChart } from '../../src/engines/najia/chart'
import { interpret } from '../../src/engines/interpretation/engine'
import { YONGSHEN_BY_CATEGORY } from '../../src/engines/interpretation/categories'
import { beijing } from '../fixtures/beijing-time'

// 固定起卦时间：2026-08-28 12:00 → 月建申、日辰戌、旬空申酉
const CAST_AT = beijing('2026-08-28 12:00')

const ALL_CATEGORIES: QuestionCategory[] = [
  'career', 'wealth', 'relationship', 'study', 'health',
  'dispute', 'travel', 'lost-item', 'other',
]

describe('类别用神映射', () => {
  it('九类问题都有候选用神', () => {
    for (const category of ALL_CATEGORIES) {
      const spec = YONGSHEN_BY_CATEGORY[category]
      expect(spec.primary.length > 0 || spec.note, category).toBeTruthy()
    }
  })

  it('感情类返回候选集合并要求用户确认视角，不预设性别角色', () => {
    const spec = YONGSHEN_BY_CATEGORY.relationship
    expect(spec.primary).toContain('官鬼')
    expect(spec.primary).toContain('妻财')
    expect(spec.note).toContain('确认')
    expect(spec.note).not.toMatch(/男|女|丈夫|妻子/)
  })
})

describe('规则顺序与依据', () => {
  it('用神出现：事业官鬼出现于第五爻（震为雷，申金官鬼）', () => {
    const chart = buildChart([7, 8, 8, 7, 8, 8], CAST_AT)
    const result = interpret(chart, 'career')
    const visibility = result.observations.find((o) => o.ruleId === 'yongshen-visibility')
    expect(visibility).toBeTruthy()
    expect(visibility!.linePositions).toEqual([5])
  })

  it('用神伏藏：天风姤妻财未现，伏于二爻之下', () => {
    const chart = buildChart([6, 7, 7, 7, 7, 7], CAST_AT)
    const result = interpret(chart, 'wealth')
    const visibility = result.observations.find((o) => o.ruleId === 'yongshen-visibility')
    expect(visibility!.observation).toContain('伏藏')
    expect(visibility!.linePositions).toEqual([2])
  })

  it('用神多现：雷泽归妹（兑宫金）官鬼出现两处', () => {
    const chart = buildChart([7, 7, 8, 7, 8, 8], CAST_AT)
    const result = interpret(chart, 'career')
    const visibility = result.observations.find((o) => o.ruleId === 'yongshen-visibility')
    expect(visibility!.observation).toContain('多现')
    expect(visibility!.linePositions).toEqual([1, 4])
  })

  it('月日生扶冲克：震为雷官鬼申金得日辰戌土相生', () => {
    const chart = buildChart([7, 8, 8, 7, 8, 8], CAST_AT)
    const result = interpret(chart, 'career')
    const strength = result.observations.find((o) => o.ruleId === 'yongshen-strength')
    expect(strength!.basis).toContain('申')
    expect(strength!.basis).toContain('戌')
  })

  it('旬空：震为雷官鬼临申金旬空，与生扶并存时总结为信号复杂', () => {
    const chart = buildChart([7, 8, 8, 7, 8, 8], CAST_AT)
    const result = interpret(chart, 'career')
    const xunkong = result.observations.find((o) => o.ruleId === 'yongshen-xunkong')
    expect(xunkong!.tendency).toBe('resistant')
    expect(result.summary).toContain('信号复杂')
  })

  it('月破：乾为天妻财寅木被月建申冲为月破', () => {
    const chart = buildChart([7, 7, 7, 7, 7, 7], CAST_AT)
    const result = interpret(chart, 'wealth')
    const po = result.observations.find((o) => o.ruleId === 'yongshen-po')
    expect(po!.observation).toContain('月破')
    expect(po!.tendency).toBe('resistant')
  })

  it('世应关系：每条卦象都会输出世应观察', () => {
    const chart = buildChart([7, 7, 7, 7, 7, 7], CAST_AT)
    const result = interpret(chart, 'career')
    const shiying = result.observations.find((o) => o.ruleId === 'shiying-relation')
    expect(shiying).toBeTruthy()
    expect(shiying!.linePositions).toHaveLength(2)
  })

  it('动变回头生：乾为天五爻动化未土回头生', () => {
    const chart = buildChart([7, 7, 7, 7, 9, 7], CAST_AT)
    const result = interpret(chart, 'career')
    const changing = result.observations.find((o) => o.ruleId === 'changing-line-relation')
    expect(changing!.linePositions).toEqual([5])
    expect(changing!.basis).toContain('回头生')
    expect(changing!.tendency).toBe('supportive')
  })

  it('卦象结构：静卦、一爻动、多爻动、六爻皆动分别标注', () => {
    const staticResult = interpret(buildChart([7, 7, 7, 7, 7, 7], CAST_AT), 'career')
    expect(staticResult.observations.find((o) => o.ruleId === 'cast-structure')!.observation).toContain('静卦')

    const singleResult = interpret(buildChart([6, 7, 7, 7, 7, 7], CAST_AT), 'career')
    expect(singleResult.observations.find((o) => o.ruleId === 'cast-structure')!.observation).toContain('一爻')

    const multiResult = interpret(buildChart([9, 9, 7, 7, 7, 7], CAST_AT), 'career')
    expect(multiResult.observations.find((o) => o.ruleId === 'cast-structure')!.observation).toContain('多爻')

    const allResult = interpret(buildChart([6, 6, 6, 6, 6, 6], CAST_AT), 'career')
    expect(allResult.observations.find((o) => o.ruleId === 'cast-structure')!.observation).toContain('六爻皆动')
    expect(allResult.observations.find((o) => o.ruleId === 'cast-structure')!.tendency).toBe('mixed')
  })
})

describe('冲突与高风险文案', () => {
  it('全部固定案例 × 全部类别：输出不含绝对化措辞，且每条观察可由 ruleId 回溯', () => {
    const banned = ['一定', '必然', '保证成功', '确诊']
    for (const fixture of FIXED_HEXAGRAM_CASES) {
      for (const category of ALL_CATEGORIES) {
        const chart = buildChart(fixture.rawValues, CAST_AT)
        const result = interpret(chart, category)
        const text = [
          result.summary,
          ...result.observations.map((o) => `${o.observation}${o.basis}`),
        ].join('\n')
        for (const word of banned) {
          expect(text, `${fixture.name} × ${category} 含禁用词 ${word}`).not.toContain(word)
        }
        for (const observation of result.observations) {
          expect(observation.ruleId).toMatch(/^[a-z-]+$/)
          expect(observation.observation.length > 0).toBe(true)
          expect(observation.basis.length > 0).toBe(true)
        }
      }
    }
  })
})

describe('高风险类别提示', () => {
  it('健康、官司、财务类别附专门提示，其余仅通用提示', () => {
    const chart = buildChart([7, 7, 7, 7, 7, 7], CAST_AT)
    expect(interpret(chart, 'health').disclaimers.join()).toContain('医疗')
    expect(interpret(chart, 'dispute').disclaimers.join()).toContain('法律')
    expect(interpret(chart, 'wealth').disclaimers.join()).toContain('财务')
    const careerDisclaimers = interpret(chart, 'career').disclaimers.join()
    expect(careerDisclaimers).toContain('娱乐参考')
    expect(careerDisclaimers).not.toContain('医疗')
  })
})
