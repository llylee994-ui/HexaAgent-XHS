import { useState } from 'react'
import type { DivinationCase } from '../../domain/types'

export interface SavePanelProps {
  caseValue: DivinationCase
  onChange(next: DivinationCase): void
}

/** 保存卦例：标题、标签、后续验证 */
export function SavePanel({ caseValue, onChange }: SavePanelProps) {
  const [title, setTitle] = useState(caseValue.title)
  const [tags, setTags] = useState(caseValue.tags.join('，'))
  const [verification, setVerification] = useState(caseValue.verification)

  const save = () => {
    const tagList = tags.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean)
    onChange({
      ...caseValue,
      title: title.trim(),
      tags: tagList,
      verification: verification.trim(),
      status: verification.trim() && caseValue.status !== 'verified' ? 'verified' : caseValue.status,
      updatedAt: new Date().toISOString(),
    })
  }

  return (
    <section className="save-panel" aria-label="保存卦例">
      <h2 className="section-title">保存卦例</h2>
      <label className="field">
        <span className="field__label">卦例标题</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="给这一卦起个名字" />
      </label>
      <label className="field">
        <span className="field__label">标签（用逗号分隔）</span>
        <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="例如：事业，面试" />
      </label>
      <label className="field">
        <span className="field__label">后续验证</span>
        <textarea
          rows={3}
          value={verification}
          onChange={(event) => setVerification(event.target.value)}
          placeholder="事后回头补充实际结果"
        />
      </label>
      <button type="button" className="btn btn--primary" onClick={save}>
        保存卦例信息
      </button>
    </section>
  )
}
