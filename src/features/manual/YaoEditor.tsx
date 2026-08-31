import type { HexagramChart, LinePosition } from '../../domain/types'
import type { ManualEditorController } from './use-manual-editor'
import { YaoEditorRow } from './YaoEditorRow'

export interface YaoEditorProps {
  controller: ManualEditorController
  chart: HexagramChart
}

const POSITIONS: readonly LinePosition[] = [6, 5, 4, 3, 2, 1]

export function YaoEditor({ controller, chart }: YaoEditorProps) {
  return (
    <section className="manual-section yao-editor" aria-label="六爻专业编辑器">
      <div className="manual-section__heading">
        <h2 className="section-title">六爻专业编辑器</h2>
      </div>
      <div className="yao-editor__list">
        {POSITIONS.map((position) => {
          const line = chart.original.lines[position - 1]
          return (
            <YaoEditorRow
              key={position}
              line={line}
              rawValue={controller.state.rawValues[position - 1]}
              override={controller.state.overrides.lines?.[position]}
              open={controller.openFushen.includes(position)}
              onLineChange={(patch) => controller.setLine(position, patch)}
              onOverrideChange={(patch) => controller.setLineOverride(position, patch)}
              onRestore={() => controller.restoreLine(position)}
              onToggleFushen={() => controller.toggleFushen(position)}
            />
          )
        })}
      </div>
      {chart.changed ? (
        <p className="review-panel__line manual-changed-summary">
          变卦：{chart.changed.name} · 动爻：{chart.changingLines.map((position) => `${position}爻`).join('、')}
        </p>
      ) : null}
    </section>
  )
}
