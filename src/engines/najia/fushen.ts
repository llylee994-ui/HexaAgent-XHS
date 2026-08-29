import type { Fushen, YaoLine } from '../../domain/types'
import { getHexagramNazhi } from './nazhi'
import { getLiuqin } from './liuqin'

const ALL_LIUQIN = ['父母', '兄弟', '子孙', '妻财', '官鬼'] as const

/**
 * 伏神：本卦缺失的六亲，取本宫纯卦同位爻的六亲与地支，伏于该爻之下。
 * 只处理本卦；变卦不布伏神（与来源项目排盘管线一致）。
 */
export function attachFushen(lines: readonly YaoLine[], palace: string, palaceElement: string): YaoLine[] {
  const present = new Set(lines.map((line) => line.liuqin))
  const missing = ALL_LIUQIN.filter((relation) => !present.has(relation))
  const next = lines.map((line) => ({ ...line, fushen: null as Fushen | null }))
  if (missing.length === 0) {
    return next
  }

  const pureNazhi = getHexagramNazhi(palace, palace)
  for (const relation of missing) {
    for (let i = 0; i < 6; i++) {
      if (getLiuqin(palaceElement, pureNazhi[i][1]) === relation) {
        next[i].fushen = { liuqin: relation, zhi: pureNazhi[i][1] }
        break
      }
    }
  }
  return next
}
