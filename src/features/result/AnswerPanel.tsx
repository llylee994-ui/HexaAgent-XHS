import { useState } from 'react'
import type { AiAnswer, CaseStatus, DivinationCase } from '../../domain/types'
import { createId } from '../../domain/ids'
import { formatZonedDateTime } from '../../engines/calendar/zoned-time'
import { ConfirmDialog } from '../../components'

const AI_SOURCES = ['ChatGPT', 'DeepSeek', '豆包', '其他'] as const

export interface AnswerPanelProps {
  caseValue: DivinationCase
  promptId: string | null
  open: boolean
  onChange(next: DivinationCase): void
}

/**
 * 删掉最后一条回答后，状态要从「已保存 AI 回答」退回上一阶段，
 * 否则历史页会显示"已保存 AI 回答"而实际没有任何回答。
 * 「已补充后续验证」不动：后续验证是独立填写的内容，不随回答消失。
 */
function statusAfterDelete(value: DivinationCase, remaining: readonly AiAnswer[]): CaseStatus {
  if (remaining.length > 0 || value.status !== 'answered') {
    return value.status
  }
  return value.prompts.length > 0 ? 'prompted' : 'cast'
}

/** 粘贴外部 AI 回答：选择来源、关联提示词快照，多个回答互不覆盖；已保存的回答可修改或删除 */
export function AnswerPanel({ caseValue, promptId, open, onChange }: AnswerPanelProps) {
  const [content, setContent] = useState('')
  const [source, setSource] = useState<string>('DeepSeek')
  const [notice, setNotice] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editSource, setEditSource] = useState<string>('DeepSeek')
  const [deleteTarget, setDeleteTarget] = useState<AiAnswer | null>(null)

  // 已保存的回答始终展示；粘贴表单仅在点击主按钮后出现
  if (!open && caseValue.answers.length === 0) return null

  const save = () => {
    if (!content.trim()) return
    if (!promptId) {
      setNotice('还没有可关联的提示词，请先在上方生成提示词再保存回答。')
      return
    }
    setNotice(null)
    const answer: AiAnswer = {
      id: createId(),
      source,
      promptId,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    }
    onChange({
      ...caseValue,
      answers: [...caseValue.answers, answer],
      // 「已补充后续验证」不回退：后续验证是独立填写的内容，补一条回答不该把它降回「已保存 AI 回答」
      status: caseValue.status === 'verified' ? 'verified' : 'answered',
      updatedAt: new Date().toISOString(),
    })
    setContent('')
  }

  const startEdit = (answer: AiAnswer) => {
    setEditingId(answer.id)
    setEditContent(answer.content)
    setEditSource(answer.source)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  const saveEdit = () => {
    if (!editingId || !editContent.trim()) return
    onChange({
      ...caseValue,
      // createdAt 保留首次保存时间，只更新内容与来源
      answers: caseValue.answers.map((answer) =>
        answer.id === editingId ? { ...answer, content: editContent.trim(), source: editSource } : answer,
      ),
      updatedAt: new Date().toISOString(),
    })
    cancelEdit()
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const answers = caseValue.answers.filter((answer) => answer.id !== deleteTarget.id)
    onChange({
      ...caseValue,
      answers,
      status: statusAfterDelete(caseValue, answers),
      updatedAt: new Date().toISOString(),
    })
    if (editingId === deleteTarget.id) cancelEdit()
    setDeleteTarget(null)
  }

  return (
    <section className="answer-panel" aria-label="AI 回答">
      <h2 className="section-title">AI 回答</h2>
      {open ? (
        <>
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
          {notice ? <p className="hint hint--warning">{notice}</p> : null}
        </>
      ) : null}

      {caseValue.answers.length > 0 ? (
        <ul className="answer-panel__list">
          {caseValue.answers.map((answer, index) => (
            <li key={answer.id} className="answer-panel__item">
              <p className="answer-panel__meta">
                {answer.source} · {formatZonedDateTime(answer.createdAt, caseValue.timeZone?.offsetMinutes)}
              </p>
              {editingId === answer.id ? (
                <div className="answer-panel__edit">
                  <label className="field">
                    <span className="field__label">回答内容</span>
                    <textarea
                      aria-label="修改 AI 回答"
                      rows={6}
                      value={editContent}
                      onChange={(event) => setEditContent(event.target.value)}
                    />
                  </label>
                  <label className="field field--inline">
                    <span className="field__label">AI 来源</span>
                    <select aria-label="修改 AI 来源" value={editSource} onChange={(event) => setEditSource(event.target.value)}>
                      {AI_SOURCES.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <div className="answer-panel__actions">
                    <button
                      type="button"
                      className="btn btn--small btn--primary"
                      onClick={saveEdit}
                      disabled={!editContent.trim()}
                    >
                      保存修改
                    </button>
                    <button type="button" className="btn btn--small" onClick={cancelEdit}>
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="answer-panel__content">{answer.content}</p>
                  <div className="answer-panel__actions">
                    <button
                      type="button"
                      className="btn btn--small"
                      aria-label={`编辑第 ${index + 1} 条 AI 回答`}
                      onClick={() => startEdit(answer)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="btn btn--small"
                      aria-label={`删除第 ${index + 1} 条 AI 回答`}
                      onClick={() => setDeleteTarget(answer)}
                    >
                      删除
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除 AI 回答"
        message={`确定删除这条 ${deleteTarget?.source ?? ''} 回答？删除后无法恢复。`}
        confirmText="确认删除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  )
}
