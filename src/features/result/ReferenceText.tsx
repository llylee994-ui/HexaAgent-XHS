import type { HexagramChart } from '../../domain/types'

export interface ReferenceTextProps {
  chart: HexagramChart
}

/** 卦爻参考：卦宫与世应的静态说明；卦爻辞全文在后续版本补充 */
export function ReferenceText({ chart }: ReferenceTextProps) {
  const shi = chart.original.lines.find((line) => line.shiYing === 'shi')
  return (
    <section className="reference-text" aria-label="卦爻参考">
      <h2 className="section-title">卦爻参考</h2>
      <p className="hint">
        {chart.original.name}属{chart.original.palace}宫（{chart.original.palaceElement}）
        {shi ? `，世爻在第${shi.position}爻` : ''}。卦爻辞全文将在后续版本补充。
      </p>
      <p className="hint">卦爻辞反映卦本身的含义，不等同于六爻综合判断。</p>
    </section>
  )
}
