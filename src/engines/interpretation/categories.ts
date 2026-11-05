import type { QuestionCategory } from '../../domain/types'

export interface YongshenSpec {
  /** 候选用神（六亲名，或特殊标记"世爻"） */
  primary: readonly string[]
  note?: string
}

/**
 * 十二类问题的候选用神。感情类存在视角差异，只返回候选集合并提示确认，
 * 不推断用户性别或角色；人物关系类给出主用神候选，复合事项仍需结合
 * 原问题确认辅助六亲；其余类别给出传统主用神。
 */
export const YONGSHEN_BY_CATEGORY: Record<QuestionCategory, YongshenSpec> = {
  career: { primary: ['官鬼'], note: '事业求职类以官鬼为用神，兼看父母爻（文书）与世爻状态。' },
  wealth: { primary: ['妻财'], note: '财运交易类以妻财为用神。' },
  relationship: {
    primary: ['官鬼', '妻财'],
    note: '感情婚姻类传统上以官鬼与妻财为两方视角，请确认以哪一爻为用神后再解读。',
  },
  children: {
    primary: ['子孙'],
    note: '所问对象为问卦人的子女或晚辈，通常以子孙爻为主用神候选；若兼问健康、学业、婚恋或工作，需结合问题原文观察相关辅助六亲。',
  },
  parents: {
    primary: ['父母'],
    note: '所问对象为问卦人的父母或长辈，通常以父母爻为主用神候选；若兼问健康、出行、财务或其他事项，需结合问题原文观察相关辅助六亲。',
  },
  siblings: {
    primary: ['兄弟'],
    note: '所问对象为问卦人的兄弟姐妹或同辈，通常以兄弟爻为主用神候选；若兼问健康、事业、婚恋或财务，需结合问题原文观察相关辅助六亲。',
  },
  study: { primary: ['父母'], note: '学业考试类以父母爻（文书、成绩）为用神。' },
  health: { primary: ['官鬼'], note: '健康类以官鬼为病象观察点，兼看世爻强弱。' },
  dispute: { primary: ['官鬼'], note: '官司纠纷类以官鬼为主要观察点。' },
  travel: { primary: ['世爻'], note: '出行类以世爻为主要观察点。' },
  'lost-item': { primary: ['妻财'], note: '失物类以妻财为用神。' },
  other: { primary: ['世爻'], note: '未归类问题以世爻与动爻为主要观察点。' },
}
