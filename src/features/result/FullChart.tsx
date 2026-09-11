import type { HexagramChart } from '../../domain/types'
import { HexagramLines } from '../../components'

const OVERRIDE_LABEL: Record<string, string> = {
  gan: '天干', zhi: '地支', liuqin: '六亲', liushen: '六神', shiYing: '世应', xunKong: '旬空', fushen: '伏神',
}

function CorrectionNotes({ lines }: { lines: HexagramChart['original']['lines'] }) {
  const corrected = [...lines].reverse().filter((line) => (line.overriddenFields?.length ?? 0) > 0)
  if (corrected.length === 0) return null
  return (
    <ul className="full-chart__corrections" aria-label="排盘人工校正">
      {corrected.map((line) => (
        <li key={line.position}>
          {line.position === 1 ? '初爻' : line.position === 2 ? '二爻' : line.position === 3 ? '三爻' : line.position === 4 ? '四爻' : line.position === 5 ? '五爻' : '上爻'}人工校正：{line.overriddenFields!.map((field) => OVERRIDE_LABEL[field] ?? field).join('、')}
        </li>
      ))}
    </ul>
  )
}

export interface FullChartProps {
  chart: HexagramChart
  /** 四柱是否经过人工校正：与按起卦时间自动推算的结果不同 */
  sizhuOverridden?: boolean
}

/** 完整排盘：本卦与变卦的逐爻干支、六亲、六神、世应、旬空与伏神 */
export function FullChart({ chart, sizhuOverridden = false }: FullChartProps) {
  return (
    <section className="full-chart" aria-label="完整排盘">
      <h2 className="section-title">完整排盘</h2>
      <p className="full-chart__meta">
        四柱：{chart.sizhu.year} {chart.sizhu.month} {chart.sizhu.day} {chart.sizhu.hour}
        {sizhuOverridden ? '（人工校正）' : ''} · 月建
        {chart.sizhu.month[1]} 日辰{chart.sizhu.day[1]} · 旬空{chart.xunKong[0]}{chart.xunKong[1]}
      </p>
      <h3 className="full-chart__subtitle">本卦 · {chart.original.name}（{chart.original.palace}宫{chart.original.palaceElement}）</h3>
      <HexagramLines figure={chart.original} changingLines={chart.changingLines} detailed />
      <CorrectionNotes lines={chart.original.lines} />
      {chart.changed ? (
        <>
          <h3 className="full-chart__subtitle">变卦 · {chart.changed.name}（六亲以本卦卦宫为准）</h3>
          <HexagramLines figure={chart.changed} detailed />
          <CorrectionNotes lines={chart.changed.lines} />
        </>
      ) : null}
    </section>
  )
}
