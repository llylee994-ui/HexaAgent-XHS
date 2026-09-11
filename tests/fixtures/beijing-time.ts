/**
 * 测试用时间帮助函数。
 *
 * 测试一律使用显式绝对时刻，禁止用 `new Date(2026, 7, 28, 12, 0)` 这类宿主本地构造，
 * 否则同一用例在不同时区环境下会得到不同结论（历史上正是这样掩盖了时区缺陷）。
 */
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/

/** 北京时间墙上时刻 → 绝对时刻 */
export function beijing(wallClock: string): Date {
  const match = WALL_CLOCK.exec(wallClock)
  if (!match) {
    throw new Error(`测试时间格式应为 'YYYY-MM-DD HH:mm'：${wallClock}`)
  }
  const [, year, month, day, hour, minute, second] = match
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), second ? Number(second) : 0) -
      BEIJING_OFFSET_MS,
  )
}

/** 北京时间墙上时刻 → 绝对时刻 ISO 字符串 */
export function beijingIso(wallClock: string): string {
  return beijing(wallClock).toISOString()
}
