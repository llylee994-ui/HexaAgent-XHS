import { getZhiWuxing } from '../calendar/ganzhi'

// 五行相生环：木→火→土→金→水→木
const WX_ORDER = ['木', '火', '土', '金', '水'] as const

/**
 * 卦宫五行（我）与爻支五行 → 六亲。
 * 同我者兄弟，我生者子孙，生我者父母，我克者妻财，克我者官鬼。
 */
export function getLiuqin(palaceElement: string, zhi: string): string {
  const yaoElement = getZhiWuxing(zhi)
  if (!yaoElement || !palaceElement) {
    throw new Error(`无法计算六亲: 卦宫${palaceElement} 爻支${zhi}`)
  }
  if (yaoElement === palaceElement) {
    return '兄弟'
  }
  const idxMe = WX_ORDER.indexOf(palaceElement as (typeof WX_ORDER)[number])
  const idxYao = WX_ORDER.indexOf(yaoElement as (typeof WX_ORDER)[number])
  const diff = (idxYao - idxMe + 5) % 5
  if (diff === 1) return '子孙' // 我生他
  if (diff === 4) return '父母' // 他生我
  if (diff === 2) return '妻财' // 我克他
  if (diff === 3) return '官鬼' // 他克我
  return '兄弟'
}
