import { useRef } from 'react'
import type { DivinationCase } from '../../domain/types'
import { generatePrompt } from '../../engines/prompt/engine'

export interface PromptPanelProps {
  caseValue: DivinationCase
  selectedPromptId: string | null
  onSelectPrompt(id: string): void
  onChange(next: DivinationCase): void
  onOpenAnswer(): void
}

/** 问 AI：生成精简/专业提示词、全选内容、醒目的回答回填入口 */
export function PromptPanel({ caseValue, selectedPromptId, onSelectPrompt, onChange, onOpenAnswer }: PromptPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selected = caseValue.prompts.find((prompt) => prompt.id === selectedPromptId) ?? null

  const generate = (variant: 'concise' | 'professional') => {
    const snapshot = generatePrompt(caseValue, variant)
    onSelectPrompt(snapshot.id)
    onChange({
      ...caseValue,
      prompts: [...caseValue.prompts, snapshot],
      status: caseValue.status === 'draft' || caseValue.status === 'cast' ? 'prompted' : caseValue.status,
      updatedAt: new Date().toISOString(),
    })
  }

  const selectAll = () => {
    textareaRef.current?.select()
  }

  return (
    <section className="prompt-panel" aria-label="问 AI">
      <h2 className="section-title">问 AI</h2>
      <div className="prompt-panel__actions">
        <button type="button" className="btn" onClick={() => generate('concise')}>
          生成精简版提示词
        </button>
        <button type="button" className="btn" onClick={() => generate('professional')}>
          生成专业版提示词
        </button>
      </div>

      {caseValue.prompts.length > 0 ? (
        <>
          {caseValue.prompts.length > 1 ? (
            <select
              aria-label="历史提示词"
              value={selected?.id ?? ''}
              onChange={(event) => onSelectPrompt(event.target.value)}
            >
              {caseValue.prompts.map((prompt, index) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.variant === 'concise' ? '精简版' : '专业版'} #{index + 1}
                </option>
              ))}
            </select>
          ) : null}
          <textarea
            ref={textareaRef}
            aria-label="提示词内容"
            className="prompt-panel__content"
            readOnly
            rows={10}
            value={selected?.content ?? ''}
          />
          <p className="hint">提示词版本：{selected?.version ?? '—'}</p>
          <button type="button" className="btn" onClick={selectAll}>
            全选内容
          </button>
          <p className="hint">已选中全部文本，请使用平台长按菜单复制。</p>
          <button type="button" className="btn btn--primary prompt-panel__answer-cta" onClick={onOpenAnswer}>
            已问过 AI？粘贴回答
          </button>
        </>
      ) : null}
    </section>
  )
}
