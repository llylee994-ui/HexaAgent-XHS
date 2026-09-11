import { useEffect, useState } from 'react'
import type { LinePosition, RawYaoValue, YaoLine } from '../../domain/types'
import type { ChartLineOverrides } from '../../engines/najia/chart'
import { LIUSHEN } from '../../engines/najia/liushen'
import { lineFromRawValue, type ManualLineInput } from './model'

export interface YaoEditorRowProps {
  line: YaoLine
  rawValue: RawYaoValue
  override?: ChartLineOverrides
  open: boolean
  onLineChange(patch: Partial<ManualLineInput>): void
  onOverrideChange(patch: ChartLineOverrides): void
  onRestore(): void
  onToggleFushen(): void
}

const POSITIONS: Record<LinePosition, string> = { 1: '初爻', 2: '二爻', 3: '三爻', 4: '四爻', 5: '五爻', 6: '上爻' }
const LIUQIN = ['父母', '兄弟', '子孙', '妻财', '官鬼']
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const CORRECTION_LABELS: Record<string, string> = {
  gan: '天干', zhi: '地支', liuqin: '六亲', liushen: '六神', shiYing: '世应', xunKong: '旬空', fushen: '伏神',
}

export function YaoEditorRow({ line, rawValue, override, open, onLineChange, onOverrideChange, onRestore, onToggleFushen }: YaoEditorRowProps) {
  const visible = POSITIONS[line.position]
  const current = lineFromRawValue(rawValue)
  const sourceFushen = override?.fushen ?? line.fushen
  const sourceFushenLiuqin = sourceFushen?.liuqin ?? ''
  const sourceFushenZhi = sourceFushen?.zhi ?? ''
  const [fushen, setFushen] = useState({ liuqin: sourceFushenLiuqin, zhi: sourceFushenZhi })

  useEffect(() => setFushen({ liuqin: sourceFushenLiuqin, zhi: sourceFushenZhi }), [sourceFushenLiuqin, sourceFushenZhi])

  const setFushenValue = (key: 'liuqin' | 'zhi', value: string) => {
    const next = { ...fushen, [key]: value }
    setFushen(next)
    onOverrideChange({ fushen: next })
  }

  const correctedFields = (line.overriddenFields ?? []).map((field) => CORRECTION_LABELS[field] ?? field)
  return (
    <article className={`yao-editor-row ${line.changing ? 'yao-editor-row--changing' : ''}`}>
      <div className="yao-editor-row__primary">
        <span className="yao-editor-row__position">{visible}</span>
        <select aria-label={`${visible}六神`} value={line.liushen} onChange={(event) => onOverrideChange({ liushen: event.target.value })}>
          {LIUSHEN.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <span className={`yao-line yao-line--${line.type}`} aria-label={line.type === 'yang' ? '阳爻' : '阴爻'} />
        <span className="yao-editor-row__type-actions" role="group" aria-label={`${visible}阴阳动静`}>
          <button type="button" className="btn btn--small" aria-label="阴" aria-pressed={current.type === 'yin'} title={`${visible}阴`} onClick={() => onLineChange({ type: 'yin' })}>阴</button>
          <button type="button" className="btn btn--small" aria-label="阳" aria-pressed={current.type === 'yang'} title={`${visible}阳`} onClick={() => onLineChange({ type: 'yang' })}>阳</button>
          <button type="button" className="btn btn--small" aria-label={`${visible}静`} aria-pressed={!current.changing} onClick={() => onLineChange({ changing: false })}>静</button>
          <button type="button" className="btn btn--small" aria-label={`${visible}动`} aria-pressed={current.changing} onClick={() => onLineChange({ changing: true })}>动</button>
        </span>
        <label className="yao-editor-row__shi-ying">
          <span>世应：</span>
          <select aria-label={`${visible}世应`} value={line.shiYing ?? ''} onChange={(event) => onOverrideChange({ shiYing: (event.target.value || null) as 'shi' | 'ying' | null })}>
            <option value="">无</option><option value="shi">世</option><option value="ying">应</option>
          </select>
        </label>
      </div>
      <div className="yao-editor-row__secondary">
        <label>六亲<select aria-label={`${visible}六亲`} value={line.liuqin} onChange={(event) => onOverrideChange({ liuqin: event.target.value })}>{LIUQIN.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label>地支<select aria-label={`${visible}地支`} value={line.zhi} onChange={(event) => onOverrideChange({ zhi: event.target.value })}>{ZHI.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <button type="button" className="btn btn--small" aria-expanded={open} onClick={onToggleFushen}>{open ? `收起${visible}伏神` : `编辑${visible}伏神`}</button>
      </div>
      {open ? (
        <div className="yao-editor-row__fushen">
          <label>伏神六亲<select aria-label={`${visible}伏神六亲`} value={fushen.liuqin} onChange={(event) => setFushenValue('liuqin', event.target.value)}><option value="">未设置</option>{LIUQIN.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <label>伏神地支<select aria-label={`${visible}伏神地支`} value={fushen.zhi} onChange={(event) => setFushenValue('zhi', event.target.value)}><option value="">未设置</option>{ZHI.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        </div>
      ) : null}
      {correctedFields.length > 0 ? <div className="manual-correction" aria-label="人工校正"><span>人工校正</span>：{correctedFields.join('、')}</div> : null}
      {correctedFields.length > 0 ? <button type="button" className="btn btn--small" onClick={onRestore}>恢复{visible}自动值</button> : null}
    </article>
  )
}
