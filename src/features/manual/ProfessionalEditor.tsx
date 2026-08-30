import type { ChartOverrides } from '../../engines/najia/chart'
import { LIUSHEN } from '../../engines/najia/liushen'

export interface ProfessionalEditorProps {
  castAt: string
  overrides: ChartOverrides
  onCastAtChange(iso: string): void
  onOverridesChange(overrides: ChartOverrides): void
}

function toInputValue(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 专业编辑：默认折叠，展开后可调整起卦时间与逐爻六神覆盖 */
export function ProfessionalEditor({ castAt, overrides, onCastAtChange, onOverridesChange }: ProfessionalEditorProps) {
  const lineOverrides = overrides.lines ?? {}

  const setLineLiushen = (position: 1 | 2 | 3 | 4 | 5 | 6, liushen: string) => {
    const lines = { ...lineOverrides }
    if (liushen === '') {
      delete lines[position]
    } else {
      lines[position] = { ...lines[position], liushen }
    }
    onOverridesChange({ ...overrides, lines: Object.keys(lines).length > 0 ? lines : undefined })
  }

  return (
    <section className="professional-editor" aria-label="专业编辑">
      <label className="field">
        <span className="field__label">起卦时间</span>
        <input
          type="datetime-local"
          value={toInputValue(castAt)}
          onChange={(event) => {
            const parsed = new Date(event.target.value)
            if (!Number.isNaN(parsed.valueOf()) && event.target.value !== '') {
              onCastAtChange(parsed.toISOString())
            }
          }}
        />
      </label>

      {[1, 2, 3, 4, 5, 6].map((position) => (
        <label key={position} className="field field--inline">
          <span className="field__label">第{position}爻六神覆盖</span>
          <select
            aria-label={`第${position}爻六神覆盖`}
            value={lineOverrides[position as 1 | 2 | 3 | 4 | 5 | 6]?.liushen ?? ''}
            onChange={(event) => setLineLiushen(position as 1 | 2 | 3 | 4 | 5 | 6, event.target.value)}
          >
            <option value="">默认</option>
            {LIUSHEN.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      ))}
    </section>
  )
}
