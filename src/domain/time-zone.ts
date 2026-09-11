import type { CastTimeZone } from './types'

/**
 * 排盘统一使用的时区：北京时间（UTC+8）。
 * 现代中国不实行夏令时，因此用固定偏移；不依赖设备时区，也不引入时区数据库。
 * 这是全库唯一的排盘时区定义，引擎与数据表都以它为准。
 */
export const CAST_TIME_ZONE: CastTimeZone = {
  id: 'Asia/Shanghai',
  label: '北京时间',
  offsetMinutes: 480,
}
