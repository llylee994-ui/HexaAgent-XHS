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
  const [saved, setSaved] = useState(false)

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
    setSaved(true)
  }

  return (
    <section className="save-panel" aria-label="保存卦例">
      <h2 className="section-title">保存卦例</h2>
      <label className="field">
        <span className="field__label">卦例标题</span>
        <input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            // 改动之后就撤下"已保存"，避免显示已经过期的状态
            setSaved(false)
          }}
          placeholder="给这一卦起个名字"
        />
      </label>
      <label className="field">
        <span className="field__label">标签（用逗号分隔）</span>
        <input
          value={tags}
          onChange={(event) => {
            setTags(event.target.value)
            setSaved(false)
          }}
          placeholder="例如：事业，面试"
        />
      </label>
      <label className="field">
        <span className="field__label">后续验证</span>
        <textarea
          rows={3}
          value={verification}
          onChange={(event) => {
            setVerification(event.target.value)
            setSaved(false)
          }}
          placeholder="事后回头补充实际结果"
        />
      </label>
      {/* 成功态换成常规按钮形态：btn--primary 是朱砂实心配白字，套上 is-success 会变成白字浅底 */}
      <button
        type="button"
        className={saved ? 'btn is-success' : 'btn btn--primary'}
        onClick={save}
      >
        保存卦例信息
      </button>
      {saved ? (
        <p className="hint" role="status">
          已保存到本机，历史记录里可以随时打开。
        </p>
      ) : null}
    </section>
  )
}
