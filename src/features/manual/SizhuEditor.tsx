import type { HexagramChart } from '../../domain/types'
import { CAST_TIME_ZONE } from '../../domain/time-zone'
import { SUPPORTED_YEAR_RANGE } from '../../engines/calendar/solar-terms'
import { parseZonedInput, toZonedInputValue } from '../../engines/calendar/zoned-time'
import type { ManualEditorController } from './use-manual-editor'

export interface SizhuEditorProps {
  controller: ManualEditorController
  chart: HexagramChart | null
}

/** 起卦时间的输入语义是排盘时区（北京时间）的墙上时刻，与设备本地时区无关 */
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
          min={`${SUPPORTED_YEAR_RANGE.fromYear}-01-01T00:00`}
          max={`${SUPPORTED_YEAR_RANGE.toYear}-12-31T23:59`}
          value={toZonedInputValue(controller.state.castAt, CAST_TIME_ZONE.offsetMinutes)}
          onChange={(event) => {
            const iso = parseZonedInput(event.target.value, CAST_TIME_ZONE.offsetMinutes)
            if (iso) controller.setCastAt(iso)
          }}
        />
      </label>
      <p className="manual-derived-note">
        按北京时间（UTC+8）解释，支持 {SUPPORTED_YEAR_RANGE.fromYear}–{SUPPORTED_YEAR_RANGE.toYear} 年
      </p>
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
