import { useRef, useState } from 'react'
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
  const [selectedAll, setSelectedAll] = useState(false)
  const selected = caseValue.prompts.find((prompt) => prompt.id === selectedPromptId) ?? null

  const generate = (variant: 'concise' | 'professional') => {
    const snapshot = generatePrompt(caseValue, variant)
    onSelectPrompt(snapshot.id)
    // 换了提示词，之前那次"已选中"的反馈不再对应当前内容
    setSelectedAll(false)
    onChange({
      ...caseValue,
      prompts: [...caseValue.prompts, snapshot],
      status: caseValue.status === 'draft' || caseValue.status === 'cast' ? 'prompted' : caseValue.status,
      updatedAt: new Date().toISOString(),
    })
  }

  // 选中文本在移动端没有明显视觉变化，必须给出明确反馈，否则这个按钮看起来"点了没反应"
  const selectAll = () => {
    textareaRef.current?.select()
    setSelectedAll(true)
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
          <button type="button" className={`btn${selectedAll ? ' is-success' : ''}`} onClick={selectAll}>
            {selectedAll ? '已全选' : '全选内容'}
          </button>
          <p className="hint" role="status">
            {selectedAll
              ? '已选中全部文本，请使用平台长按菜单复制。'
              : '点「全选内容」选中全部文本，再用平台长按菜单复制。'}
          </p>
          <button type="button" className="btn btn--primary prompt-panel__answer-cta" onClick={onOpenAnswer}>
            已问过 AI？粘贴回答
          </button>
        </>
      ) : null}
    </section>
  )
}
