import type { RawYaoValue, YinYang } from '../domain/types'

export interface CoinProps {
  face: 0 | 1
  label: string
  onFlip?: () => void
}

/** 单枚铜钱：1 正面，0 反面。可点击时为实体投币录入模式 */
export function Coin({ face, label, onFlip }: CoinProps) {
  if (onFlip) {
    return (
      <button
        type="button"
        className={`coin ${face === 1 ? 'coin--front' : 'coin--back'}`}
        aria-label={label}
        aria-pressed={face === 1}
        onClick={onFlip}
      >
        {face === 1 ? '正' : '反'}
      </button>
    )
  }
  return (
    <span
      className={`coin coin--static ${face === 1 ? 'coin--front' : 'coin--back'}`}
      role="img"
      aria-label={label}
    >
      {face === 1 ? '正' : '反'}
    </span>
  )
}

export interface YaoStackProps {
  rawValues: readonly RawYaoValue[]
}

/** 已完成的爻，按上爻到初爻自上而下堆叠 */
export function YaoStack({ rawValues }: YaoStackProps) {
  const lines = rawValues.map((rawValue, index) => {
    const type: YinYang = rawValue === 7 || rawValue === 9 ? 'yang' : 'yin'
    const changing = rawValue === 6 || rawValue === 9
    const position = (index + 1) as 1 | 2 | 3 | 4 | 5 | 6
    return { position, type, changing }
  })

  return (
    <ul className="yao-stack" aria-label="已完成卦爻">
      {[...lines].reverse().map((line) => (
        <li key={line.position} className={`yao-stack__item ${line.changing ? 'yao-stack__item--changing' : ''}`}>
          <span className="yao-stack__label">
            第{line.position}爻 {line.type === 'yang' ? '阳' : '阴'}
            {line.changing ? '·动' : ''}
          </span>
          {line.type === 'yang' ? (
            <span className="yao-line yao-line--yang" aria-hidden="true" />
          ) : (
            <span className="yao-line yao-line--yin" aria-hidden="true" />
          )}
        </li>
      ))}
    </ul>
  )
}

export interface ProgressHeaderProps {
  question: string
  completedCount: number
}

/** 摇卦进度：始终显示当前问题与"第 N 爻 / 共六爻" */
export function ProgressHeader({ question, completedCount }: ProgressHeaderProps) {
  const nextPosition = Math.min(completedCount + 1, 6)
  return (
    <header className="progress-header">
      {question ? <p className="progress-header__question">{question}</p> : null}
      <p className="progress-header__progress">第 {nextPosition} 爻 / 共六爻</p>
    </header>
  )
}

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) {
    return null
  }
  return (
    <div className="confirm-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <div className="confirm-dialog__panel">
        <h2 className="confirm-dialog__title">{title}</h2>
        <p className="confirm-dialog__message">{message}</p>
        <div className="confirm-dialog__actions">
          <button type="button" className="btn" onClick={onCancel}>
            {cancelText}
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
