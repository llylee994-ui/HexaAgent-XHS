import type { HexagramChart, InterpretationObservation, InterpretationTendency, LinePosition, YaoLine } from '../../domain/types'
import { getZhiWuxing } from '../calendar/ganzhi'
import { ZHI_LIUCHONG, relationOf, RELATION_LABEL, type Relation } from './relations'
import type { YongshenSpec } from './categories'

export interface RuleContext {
  chart: HexagramChart
  spec: YongshenSpec
  /** 月建（月支）与日辰（日支） */
  yueJian: string
  riChen: string
  /** 用神爻（六亲匹配或世爻） */
  yongshenLines: readonly YaoLine[]
  /** 用神伏藏位置（伏神挂在哪条爻下） */
  yongshenFushen: readonly { line: YaoLine; liuqin: string; zhi: string }[]
}

export type Rule = (context: RuleContext) => InterpretationObservation[]

function observation(
  ruleId: string,
  observationText: string,
  basis: string,
  tendency: InterpretationTendency,
  linePositions: LinePosition[],
): InterpretationObservation {
  return { ruleId, observation: observationText, basis, tendency, linePositions }
}

function describeLine(line: YaoLine): string {
  return `第${line.position}爻${line.zhi}${line.wuxing}`
}

/** 规则一：用神出现、伏藏或多现 */
export const yongshenVisibility: Rule = ({ spec, yongshenLines, yongshenFushen }) => {
  const label = spec.primary.join(' / ')
  if (yongshenLines.length === 1) {
    const line = yongshenLines[0]
    return [
      observation(
        'yongshen-visibility',
        `用神${label}出现于${describeLine(line)}。`,
        `本卦六亲按${spec.primary.join('、')}匹配，唯一命中。${spec.note ?? ''}`,
        'neutral',
        [line.position],
      ),
    ]
  }
  if (yongshenLines.length >= 2) {
    const positions = yongshenLines.map((line) => line.position)
    return [
      observation(
        'yongshen-visibility',
        `用神${label}多现，共${yongshenLines.length}处。`,
        `出现于第${positions.join('、')}爻，取用需结合旺衰取舍。${spec.note ?? ''}`,
        'neutral',
        positions,
      ),
    ]
  }
  if (yongshenFushen.length > 0) {
    const found = yongshenFushen[0]
    return [
      observation(
        'yongshen-visibility',
        `用神${found.liuqin}未现于卦中，伏藏于${describeLine(found.line)}之下。`,
        `依据本宫纯卦伏神规则，${found.liuqin}${found.zhi}伏于第${found.line.position}爻。${spec.note ?? ''}`,
        'neutral',
        [found.line.position],
      ),
    ]
  }
  return [
    observation(
      'yongshen-visibility',
      `用神${label}未出现且无伏神。`,
      `本卦及伏神中均无${spec.primary.join('、')}，缺少直接观察点，仅能从世应与动爻推断。${spec.note ?? ''}`,
      'neutral',
      [],
    ),
  ]
}

/** 规则二：月建、日辰对用神的生扶冲克 */
export const yongshenStrength: Rule = ({ yongshenLines, yueJian, riChen }) => {
  if (yongshenLines.length === 0) return []
  const lines = yongshenLines.length <= 2 ? yongshenLines : yongshenLines.slice(0, 2)
  return lines.map((line) => {
    const yueRelation: Relation = relationOf(getZhiWuxing(yueJian), line.wuxing)
    const riRelation: Relation = relationOf(getZhiWuxing(riChen), line.wuxing)
    const supported = yueRelation === 'sheng' || yueRelation === 'same' || riRelation === 'sheng' || riRelation === 'same'
    const attacked = yueRelation === 'ke' || riRelation === 'ke'
    const tendency: InterpretationTendency = supported && attacked ? 'mixed' : supported ? 'supportive' : attacked ? 'resistant' : 'neutral'
    return observation(
      'yongshen-strength',
      `用神所在${describeLine(line)}，月建${yueJian}${getZhiWuxing(yueJian)}与之${RELATION_LABEL[yueRelation]}，日辰${riChen}${getZhiWuxing(riChen)}与之${RELATION_LABEL[riRelation]}。`,
      `月建${yueJian}、日辰${riChen}对照用神五行${line.wuxing}：${supported ? '得生扶' : '不得生扶'}${attacked ? '，且受冲克' : ''}。`,
      tendency,
      [line.position],
    )
  })
}

/** 规则三：用神旬空 */
export const yongshenXunKong: Rule = ({ yongshenLines, yongshenFushen, chart }) => {
  const results: InterpretationObservation[] = []
  for (const line of yongshenLines) {
    if (line.xunKong) {
      results.push(
        observation(
          'yongshen-xunkong',
          `用神所在${describeLine(line)}临旬空。`,
          `当前旬空为${chart.xunKong[0]}${chart.xunKong[1]}，用神地支入空，短期难以落实。`,
          'resistant',
          [line.position],
        ),
      )
    }
  }
  for (const found of yongshenFushen) {
    if (found.line.xunKong) {
      results.push(
        observation(
          'yongshen-xunkong',
          `伏神${found.liuqin}${found.zhi}所伏之爻临旬空。`,
          `伏神飞神同临旬空，伏藏之力更弱。`,
          'resistant',
          [found.line.position],
        ),
      )
    }
  }
  return results
}

/** 规则四：月破与日破（月建、日辰冲用神） */
export const yongshenPo: Rule = ({ yongshenLines, yueJian, riChen }) => {
  const results: InterpretationObservation[] = []
  for (const line of yongshenLines) {
    if (ZHI_LIUCHONG[yueJian] === line.zhi) {
      results.push(
        observation(
          'yongshen-po',
          `用神所在${describeLine(line)}被月建${yueJian}冲，为月破。`,
          `月建${yueJian}冲${line.zhi}，用神受冲则力散。`,
          'resistant',
          [line.position],
        ),
      )
    }
    if (ZHI_LIUCHONG[riChen] === line.zhi) {
      results.push(
        observation(
          'yongshen-po',
          `用神所在${describeLine(line)}被日辰${riChen}冲。`,
          `日辰${riChen}冲${line.zhi}，日冲为破或暗动需结合旺衰判断。`,
          'resistant',
          [line.position],
        ),
      )
    }
  }
  return results
}

/** 规则五：世应关系 */
export const shiyingRelation: Rule = ({ chart }) => {
  const shi = chart.original.lines.find((line) => line.shiYing === 'shi')
  const ying = chart.original.lines.find((line) => line.shiYing === 'ying')
  if (!shi || !ying) return []

  const relation: Relation = relationOf(shi.wuxing, ying.wuxing)
  const textMap: Record<Relation, { text: string; tendency: InterpretationTendency }> = {
    sheng: { text: '世爻生应爻，世方付出较多', tendency: 'neutral' },
    ke: { text: '世爻克制应爻，世方占主动', tendency: 'neutral' },
    same: { text: '世应五行比和，双方状态相近', tendency: 'supportive' },
    other: { text: '应爻生扶世爻，外部环境助力世方', tendency: 'supportive' },
  }
  // 应生世 = 应爻五行生世爻五行
  const yingShengShi = relationOf(ying.wuxing, shi.wuxing) === 'sheng'
  const yingKeShi = relationOf(ying.wuxing, shi.wuxing) === 'ke'
  const resolved = yingShengShi
    ? { text: '应爻生扶世爻，外部环境对世方有助力', tendency: 'supportive' as const }
    : yingKeShi
      ? { text: '应爻克制世爻，外部环境对世方形成压力', tendency: 'resistant' as const }
      : textMap[relation]

  return [
    observation(
      'shiying-relation',
      `世爻${describeLine(shi)}，应爻${describeLine(ying)}，${resolved.text}。`,
      `世在第${shi.position}爻（${shi.wuxing}），应在第${ying.position}爻（${ying.wuxing}），五行${yingShengShi ? '应生世' : yingKeShi ? '应克世' : RELATION_LABEL[relation]}。`,
      resolved.tendency,
      [shi.position, ying.position],
    ),
  ]
}

/** 规则六：动爻与变爻的回头生克 */
export const changingLineRelation: Rule = ({ chart }) => {
  if (!chart.changed) return []
  const results: InterpretationObservation[] = []
  chart.original.lines
    .filter((line) => line.changing)
    .forEach((line) => {
      const changedLine = chart.changed!.lines[line.position - 1]
      const backRelation = relationOf(changedLine.wuxing, line.wuxing)
      const forwardRelation = relationOf(line.wuxing, changedLine.wuxing)
      if (backRelation === 'sheng') {
        results.push(
          observation(
            'changing-line-relation',
            `第${line.position}爻${line.zhi}${line.wuxing}动，化为${changedLine.zhi}${changedLine.wuxing}，变爻回头生助动爻。`,
            `变爻${changedLine.wuxing}生动爻${line.wuxing}，为回头生。`,
            'supportive',
            [line.position],
          ),
        )
      } else if (backRelation === 'ke') {
        results.push(
          observation(
            'changing-line-relation',
            `第${line.position}爻${line.zhi}${line.wuxing}动，化为${changedLine.zhi}${changedLine.wuxing}，变爻回头克制动爻。`,
            `变爻${changedLine.wuxing}克动爻${line.wuxing}，为回头克。`,
            'resistant',
            [line.position],
          ),
        )
      } else if (forwardRelation === 'sheng') {
        results.push(
          observation(
            'changing-line-relation',
            `第${line.position}爻${line.zhi}${line.wuxing}动，化为${changedLine.zhi}${changedLine.wuxing}，动爻之气泄于变爻。`,
            `动爻${line.wuxing}生变爻${changedLine.wuxing}，为化泄，力量外散。`,
            'neutral',
            [line.position],
          ),
        )
      } else if (forwardRelation === 'ke') {
        results.push(
          observation(
            'changing-line-relation',
            `第${line.position}爻${line.zhi}${line.wuxing}动，化为${changedLine.zhi}${changedLine.wuxing}，动爻克变爻。`,
            `动爻${line.wuxing}克变爻${changedLine.wuxing}，为化克，需看用神是否受累。`,
            'neutral',
            [line.position],
          ),
        )
      } else {
        results.push(
          observation(
            'changing-line-relation',
            `第${line.position}爻${line.zhi}${line.wuxing}动，化为${changedLine.zhi}${changedLine.wuxing}，五行比和。`,
            `动爻与变爻五行相同，变化平缓。`,
            'neutral',
            [line.position],
          ),
        )
      }
    })
  return results
}

/** 规则七：卦象结构（静卦、一爻动、多爻动、六爻皆动） */
export const castStructure: Rule = ({ chart }) => {
  const count = chart.changingLines.length
  if (count === 0) {
    return [
      observation(
        'cast-structure',
        '六爻安静，本卦为静卦。',
        '无动爻时以卦象与旺衰为主，变化节奏较慢。',
        'neutral',
        [],
      ),
    ]
  }
  if (count === 1) {
    return [
      observation(
        'cast-structure',
        `一爻独发，第${chart.changingLines[0]}爻发动。`,
        '一爻动时该爻为事机核心，重点关注其生克去向。',
        'neutral',
        [...chart.changingLines],
      ),
    ]
  }
  if (count < 6) {
    return [
      observation(
        'cast-structure',
        `多爻齐动，第${chart.changingLines.join('、')}爻发动。`,
        `${count}个动爻信号交织，需分主次判断。`,
        'neutral',
        [...chart.changingLines],
      ),
    ]
  }
  return [
    observation(
      'cast-structure',
      '六爻皆动，卦象结构特殊。',
      '全部爻位发动，信号相互交织，仅凭离线规则难以取舍。',
      'mixed',
      [...chart.changingLines],
    ),
  ]
}

/** 规则执行顺序：用神 → 旺衰 → 空破 → 世应 → 动变 → 结构 */
export const RULES: readonly Rule[] = [
  yongshenVisibility,
  yongshenStrength,
  yongshenXunKong,
  yongshenPo,
  shiyingRelation,
  changingLineRelation,
  castStructure,
]
