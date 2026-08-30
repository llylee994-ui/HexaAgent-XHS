import type { HexagramChart } from '../../domain/types'
import { HexagramLines } from '../../components'

export interface FullChartProps {
  chart: HexagramChart
}

/** 完整排盘：本卦与变卦的逐爻干支、六亲、六神、世应、旬空与伏神 */
export function FullChart({ chart }: FullChartProps) {
  return (
    <section className="full-chart" aria-label="完整排盘">
      <h2 className="section-title">完整排盘</h2>
      <p className="full-chart__meta">
        四柱：{chart.sizhu.year} {chart.sizhu.month} {chart.sizhu.day} {chart.sizhu.hour} · 月建
        {chart.sizhu.month[1]} 日辰{chart.sizhu.day[1]} · 旬空{chart.xunKong[0]}{chart.xunKong[1]}
      </p>
      <h3 className="full-chart__subtitle">本卦 · {chart.original.name}（{chart.original.palace}宫{chart.original.palaceElement}）</h3>
      <HexagramLines figure={chart.original} changingLines={chart.changingLines} detailed />
      {chart.changed ? (
        <>
          <h3 className="full-chart__subtitle">变卦 · {chart.changed.name}（六亲以本卦卦宫为准）</h3>
          <HexagramLines figure={chart.changed} detailed />
        </>
      ) : null}
    </section>
  )
}
