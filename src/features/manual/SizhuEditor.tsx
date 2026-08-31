import type { HexagramChart } from '../../domain/types'
import type { ManualEditorController } from './use-manual-editor'

export interface SizhuEditorProps {
  controller: ManualEditorController
  chart: HexagramChart | null
}

function toInputValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function SizhuEditor({ controller, chart }: SizhuEditorProps) {
  const sizhu = chart?.sizhu ?? { year: '', month: '', day: '', hour: '' }
  return (
    <section className="manual-section manual-sizhu" aria-label="起卦时间与四柱">
      <h2 className="section-title">起卦时间与四柱</h2>
      <label className="field">
        <span className="field__label">起卦时间</span>
        <input
          aria-label="起卦时间"
          type="datetime-local"
          value={toInputValue(controller.state.castAt)}
          onChange={(event) => {
            const next = new Date(event.target.value)
            if (!Number.isNaN(next.getTime())) controller.setCastAt(next.toISOString())
          }}
        />
      </label>
      <div className="sizhu-grid">
        {(['year', 'month', 'day', 'hour'] as const).map((key) => (
          <label className="field" key={key}>
            <span className="field__label">{key === 'year' ? '年柱' : key === 'month' ? '月柱' : key === 'day' ? '日柱' : '时柱'}</span>
            <input
              aria-label={key === 'year' ? '年柱' : key === 'month' ? '月柱' : key === 'day' ? '日柱' : '时柱'}
              value={sizhu[key]}
              onChange={(event) => controller.setSizhu({ ...sizhu, [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      <p className="manual-derived-note">空亡：{chart?.xunKong.join('、') || '待计算'}</p>
      <button type="button" className="btn btn--small" onClick={controller.useCalculatedSizhu}>
        使用起卦时间重新计算
      </button>
    </section>
  )
}
