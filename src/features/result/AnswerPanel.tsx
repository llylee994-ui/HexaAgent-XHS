import { useState } from 'react'
import type { AiAnswer, DivinationCase } from '../../domain/types'

const AI_SOURCES = ['ChatGPT', 'DeepSeek', '豆包', '其他'] as const

export interface AnswerPanelProps {
  caseValue: DivinationCase
  promptId: string | null
  open: boolean
  onChange(next: DivinationCase): void
}

/** 粘贴外部 AI 回答：选择来源、关联提示词快照，多个回答互不覆盖 */
export function AnswerPanel({ caseValue, promptId, open, onChange }: AnswerPanelProps) {
  const [content, setContent] = useState('')
  const [source, setSource] = useState<string>('DeepSeek')

  if (!open) return null

  const save = () => {
    if (!content.trim() || !promptId) return
    const answer: AiAnswer = {
      id: crypto.randomUUID(),
      source,
      promptId,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    }
    onChange({
      ...caseValue,
      answers: [...caseValue.answers, answer],
      status: 'answered',
      updatedAt: new Date().toISOString(),
    })
    setContent('')
  }

  return (
    <section className="answer-panel" aria-label="AI 回答">
      <h2 className="section-title">AI 回答</h2>
      <label className="field">
        <span className="field__label">粘贴 AI 回答</span>
        <textarea
          aria-label="粘贴 AI 回答"
          rows={6}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="回到外部 AI 界面复制回答，粘贴到这里保存"
        />
      </label>
      <label className="field field--inline">
        <span className="field__label">AI 来源</span>
        <select aria-label="AI 来源" value={source} onChange={(event) => setSource(event.target.value)}>
          {AI_SOURCES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>
      <button type="button" className="btn btn--primary" onClick={save} disabled={!content.trim()}>
        保存回答
      </button>

      {caseValue.answers.length > 0 ? (
        <ul className="answer-panel__list">
          {caseValue.answers.map((answer) => (
            <li key={answer.id} className="answer-panel__item">
              <p className="answer-panel__meta">
                {answer.source} · {answer.createdAt.slice(0, 16).replace('T', ' ')}
              </p>
              <p className="answer-panel__content">{answer.content}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
