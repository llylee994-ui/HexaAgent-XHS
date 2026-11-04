import type { QuestionCategory } from '../../domain/types'

export const QUESTION_CATEGORY_OPTIONS: readonly { value: QuestionCategory; label: string }[] = [
  { value: 'career', label: '事业/求职' },
  { value: 'wealth', label: '财运/交易' },
  { value: 'relationship', label: '感情/婚姻' },
  { value: 'children', label: '子女／晚辈' },
  { value: 'parents', label: '父母／长辈' },
  { value: 'siblings', label: '兄弟姐妹／同辈' },
  { value: 'study', label: '学业/考试' },
  { value: 'health', label: '健康' },
  { value: 'dispute', label: '官司/纠纷' },
  { value: 'travel', label: '出行' },
  { value: 'lost-item', label: '失物' },
  { value: 'other', label: '其他' },
]
