import type { CastTimeZone, ZonedParts } from '../../domain/types'
import { CAST_TIME_ZONE } from '../../domain/time-zone'

/** 排盘统一时区由 domain 定义（北京时间 UTC+8），此处重新导出便于引擎内使用 */
export { CAST_TIME_ZONE }

const MINUTE_MS = 60_000

function asInstant(value: Date | number | string): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Date.parse(value)
  return value.valueOf()
}

/**
 * 绝对时刻 → 指定时区的日历字段。
 * 实现只读 UTC 字段：整体平移偏移量后，UTC 字段即目标时区的墙上时刻。
 */
export function toZonedParts(
  instant: Date | number | string,
  offsetMinutes: number = CAST_TIME_ZONE.offsetMinutes,
): ZonedParts {
  const shifted = new Date(asInstant(instant) + offsetMinutes * MINUTE_MS)
  if (Number.isNaN(shifted.valueOf())) {
    throw new Error('时间无效')
  }
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  }
}

/** 指定时区的日历字段 → 绝对时刻（ms） */
export function fromZonedParts(
  parts: ZonedParts,
  offsetMinutes: number = CAST_TIME_ZONE.offsetMinutes,
): number {
  return (
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) -
    offsetMinutes * MINUTE_MS
  )
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** 偏移量文本，如 UTC+8 / UTC-3:30 */
export function formatUtcOffset(offsetMinutes: number = CAST_TIME_ZONE.offsetMinutes): string {
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absolute = Math.abs(offsetMinutes)
  const hours = Math.floor(absolute / 60)
  const minutes = absolute % 60
  return `UTC${sign}${hours}${minutes ? `:${pad(minutes)}` : ''}`
}

/** 时区标签，如「北京时间 UTC+8」 */
export function formatZoneLabel(zone: CastTimeZone = CAST_TIME_ZONE): string {
  return `${zone.label} ${formatUtcOffset(zone.offsetMinutes)}`
}

/** 绝对时刻 → 'YYYY-MM-DD HH:mm'（该时区墙上时刻）；非法输入返回占位符 */
export function formatZonedDateTime(
  iso: string,
  offsetMinutes: number = CAST_TIME_ZONE.offsetMinutes,
): string {
  const instant = asInstant(iso)
  if (Number.isNaN(instant)) return '—'
  const parts = toZonedParts(instant, offsetMinutes)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`
}

/** 绝对时刻 → 'YYYY-MM-DD HH:mm（北京时间 UTC+8）' */
export function formatZonedTimestamp(iso: string, zone: CastTimeZone = CAST_TIME_ZONE): string {
  return `${formatZonedDateTime(iso, zone.offsetMinutes)}（${formatZoneLabel(zone)}）`
}

/** 'YYYY-MM-DDTHH:mm'（该时区墙上时刻）→ 绝对时刻 ISO；格式或日期非法返回 null */
export function parseZonedInput(
  value: string,
  offsetMinutes: number = CAST_TIME_ZONE.offsetMinutes,
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  const parts: ZonedParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: 0,
  }
  const instant = fromZonedParts(parts, offsetMinutes)
  const roundTrip = toZonedParts(instant, offsetMinutes)
  // 拒绝 2026-02-30 这类回读后字段不一致的输入
  if (
    roundTrip.year !== parts.year ||
    roundTrip.month !== parts.month ||
    roundTrip.day !== parts.day ||
    roundTrip.hour !== parts.hour ||
    roundTrip.minute !== parts.minute
  ) {
    return null
  }
  return new Date(instant).toISOString()
}

/** 绝对时刻 ISO → datetime-local 输入值（该时区墙上时刻） */
export function toZonedInputValue(
  iso: string,
  offsetMinutes: number = CAST_TIME_ZONE.offsetMinutes,
): string {
  const instant = asInstant(iso)
  if (Number.isNaN(instant)) return ''
  const parts = toZonedParts(instant, offsetMinutes)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}
