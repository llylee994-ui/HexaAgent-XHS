import type { QuestionCategory } from '../../domain/types'

export interface YongshenSpec {
  /** 候选用神（六亲名，或特殊标记"世爻"） */
  primary: readonly string[]
  note?: string
}

/**
 * 九类问题的候选用神。感情类存在视角差异，只返回候选集合并提示确认，
 * 不推断用户性别或角色；其余类别给出传统主用神。
 */
export const YONGSHEN_BY_CATEGORY: Record<QuestionCategory, YongshenSpec> = {
  career: { primary: ['官鬼'], note: '事业求职类以官鬼为用神，兼看父母爻（文书）与世爻状态。' },
  wealth: { primary: ['妻财'], note: '财运交易类以妻财为用神。' },
  relationship: {
    primary: ['官鬼', '妻财'],
    note: '感情婚姻类传统上以官鬼与妻财为两方视角，请确认以哪一爻为用神后再解读。',
  },
  study: { primary: ['父母'], note: '学业考试类以父母爻（文书、成绩）为用神。' },
  health: { primary: ['官鬼'], note: '健康类以官鬼为病象观察点，兼看世爻强弱。' },
  dispute: { primary: ['官鬼'], note: '官司纠纷类以官鬼为主要观察点。' },
  travel: { primary: ['世爻'], note: '出行类以世爻为主要观察点。' },
  'lost-item': { primary: ['妻财'], note: '失物类以妻财为用神。' },
  other: { primary: ['世爻'], note: '未归类问题以世爻与动爻为主要观察点。' },
}
