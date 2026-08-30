import { useState } from 'react'
import type { QuestionCategory } from '../../domain/types'
import { QUESTION_CATEGORY_OPTIONS } from '../shared/categories'

export interface QuestionStepProps {
  initialQuestion?: string
  initialCategory?: QuestionCategory | ''
  initialNote?: string
  submitText?: string
  onSubmit(input: { question: string; category: QuestionCategory; note: string }): void
}

/** 流程第一步：提出问题、选择类别，可选备注 */
export function QuestionStep({
  initialQuestion = '',
  initialCategory = '',
  initialNote = '',
  submitText = '下一步',
  onSubmit,
}: QuestionStepProps) {
  const [question, setQuestion] = useState(initialQuestion)
  const [category, setCategory] = useState<QuestionCategory | ''>(initialCategory)
  const [note, setNote] = useState(initialNote)

  return (
    <form
      className="question-step"
      onSubmit={(event) => {
        event.preventDefault()
        if (!question.trim() || !category) return
        onSubmit({ question: question.trim(), category, note })
      }}
    >
      <label className="field">
        <span className="field__label">你的问题</span>
        <input
          name="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="想问什么就写什么，越具体越好"
        />
      </label>
      <label className="field">
        <span className="field__label">问题类别</span>
        <select
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value as QuestionCategory | '')}
        >
          <option value="">请选择类别</option>
          {QUESTION_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">备注（可选）</span>
        <input
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="补充背景信息"
        />
      </label>
      <button type="submit" className="btn btn--primary" disabled={!question.trim() || !category}>
        {submitText}
      </button>
    </form>
  )
}
