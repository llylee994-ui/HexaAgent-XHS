/**
 * 生成十二"节"交节时刻数据表 src/engines/calendar/solar-terms-data.ts。
 *
 * 用法（依赖只用于生成，不进运行时，也不写入 package.json）：
 *   npm i --no-save lunar-javascript@1.7.7
 *   node scripts/generate-solar-terms.mjs
 *
 * 生成范围 1899–2100：表首多出 1899 年，用于解析 1900 年 1 月小寒之前、需要回退到上一年大雪的时刻。
 * 精度核对不在此脚本内进行：`tests/unit/solar-terms.test.ts` 会把生成结果与
 * `tests/fixtures/hko-solar-terms.ts`（香港天文台公布的 2019–2028 年 12 节时刻）逐项比较。
 */
import { writeFileSync } from 'node:fs'
import { Solar } from 'lunar-javascript'

const NAMES24 = ['小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至']
/** 十二"节"：与运行时 JIE_NAMES 的顺序一致 */
const JIE = NAMES24.filter((_, index) => index % 2 === 0)
const FROM_YEAR = 1899
const TO_YEAR = 2100

/**
 * 某年 12 个"节"距当年 1 月 1 日 00:00（UTC+8）的分钟数。
 * 北京时间墙上时刻 W 对应的真实绝对时刻 = 把 W 的字段当作 UTC 再减 8 小时，
 * 因此这里用「墙上时刻字段直接当 UTC」的差值，不额外加减时差。
 */
function jieOffsetMinutes(year) {
  const table = Solar.fromYmd(year, 1, 1).getLunar().getJieQiTable()
  return JIE.map((name) => {
    const moment = table[name]
    if (!moment || moment.getYear() !== year) {
      throw new Error(`${year} 年 ${name} 缺失或跨年，无法生成数据表`)
    }
    const wallAsUtc = Date.UTC(moment.getYear(), moment.getMonth() - 1, moment.getDay(), moment.getHour(), moment.getMinute(), moment.getSecond())
    return Math.round((wallAsUtc - Date.UTC(year, 0, 1)) / 60_000)
  })
}

const lines = [
  '/**',
  ' * 十二"节"交节时刻数据表（1899–2100），用于年柱与月柱的界分。',
  ' *',
  ' * 单位：距当年 1 月 1 日 00:00（UTC+8）的分钟数，顺序为',
  ' * 小寒、立春、惊蛰、清明、立夏、芒种、小暑、立秋、白露、寒露、立冬、大雪。',
  ' *',
  ' * 由 scripts/generate-solar-terms.mjs 生成（lunar-javascript，寿星万年历算法），请勿手工编辑。',
  ' * 精度核对见 tests/unit/solar-terms.test.ts：与香港天文台《二十四節氣的日期及時間資料》',
  ' * （香港時間 = UTC+8）2019–2028 年 12 节逐项比较，全部在 60 秒以内。',
  ' * 数据来源：https://www.hko.gov.hk/tc/gts/astronomy/Solar_Term.htm（取数日期 2026-09-11）',
  ' * 本表只收录十二"节"（月界），未收录十二"气"（中气）。',
  ' * 表首多收录 1899 年，用于解析 1900 年 1 月小寒之前的时刻（需回退到上一年的大雪）。',
  ' */',
  `export const SOLAR_TERM_FROM_YEAR = ${FROM_YEAR}`,
  `export const SOLAR_TERM_TO_YEAR = ${TO_YEAR}`,
  '',
  '/** 索引 = 年份 - SOLAR_TERM_FROM_YEAR */',
  'export const JIE_OFFSET_MINUTES: readonly (readonly number[])[] = [',
]
for (let year = FROM_YEAR; year <= TO_YEAR; year += 1) {
  lines.push(`  /* ${year} */ [${jieOffsetMinutes(year).join(', ')}],`)
}
lines.push(']', '')

const target = new URL('../src/engines/calendar/solar-terms-data.ts', import.meta.url)
writeFileSync(target, lines.join('\n'), 'utf8')
console.log(`已写入 ${target.pathname}：${TO_YEAR - FROM_YEAR + 1} 年 × 12 节`)
