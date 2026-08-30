import type { RawYaoValue } from '../../domain/types'

export interface QuickEntryProps {
  entries: readonly (RawYaoValue | null)[]
  onChange(index: number, value: RawYaoValue | null): void
}

/** 由爻值推导阴阳与动静 */
function toTypeChanging(value: RawYaoValue | null): { type: 'yin' | 'yang'; changing: boolean } {
  const changing = value === 6 || value === 9
  const type: 'yin' | 'yang' = value === 7 || value === 9 ? 'yang' : 'yin'
  return { type, changing }
}

function valueFrom(type: 'yin' | 'yang', changing: boolean): RawYaoValue {
  if (changing) return type === 'yang' ? 9 : 6
  return type === 'yang' ? 7 : 8
}

/** 快速录入：每爻支持直接输入 6/7/8/9，或阴阳 + 动静等价输入 */
export function QuickEntry({ entries, onChange }: QuickEntryProps) {
  return (
    <div className="quick-entry">
      {entries.map((value, index) => {
        const position = index + 1
        const { type, changing } = toTypeChanging(value)
        return (
          <div key={position} className="quick-entry__row">
            <span className="quick-entry__label">第{position}爻</span>
            <select
              aria-label={`第${position}爻爻值`}
              value={value === null ? '' : String(value)}
              onChange={(event) =>
                onChange(index, event.target.value === '' ? null : (Number(event.target.value) as RawYaoValue))
              }
            >
              <option value="">未填</option>
              <option value="6">6 老阴</option>
              <option value="7">7 少阳</option>
              <option value="8">8 少阴</option>
              <option value="9">9 老阳</option>
            </select>
            <div className="quick-entry__toggles" role="group" aria-label={`第${position}爻阴阳动静`}>
              <button
                type="button"
                aria-label={`第${position}爻阴`}
                aria-pressed={type === 'yin'}
                className="btn btn--small"
                onClick={() => onChange(index, valueFrom('yin', changing))}
              >
                阴
              </button>
              <button
                type="button"
                aria-label={`第${position}爻阳`}
                aria-pressed={type === 'yang'}
                className="btn btn--small"
                onClick={() => onChange(index, valueFrom('yang', changing))}
              >
                阳
              </button>
              <button
                type="button"
                aria-label={`第${position}爻静`}
                aria-pressed={!changing}
                className="btn btn--small"
                onClick={() => onChange(index, valueFrom(type, false))}
              >
                静
              </button>
              <button
                type="button"
                aria-label={`第${position}爻动`}
                aria-pressed={changing}
                className="btn btn--small"
                onClick={() => onChange(index, valueFrom(type, true))}
              >
                动
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
