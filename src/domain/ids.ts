/**
 * 生成记录标识（UUID v4 形态，仅要求非空字符串）。
 *
 * 不能用 `crypto.randomUUID()`：它只在安全上下文（https / localhost）可用，
 * 容器用 `http://` 或自定义 scheme 打开页面时该方法不存在，会让首页入口直接点不动。
 * `crypto.getRandomValues` 没有这个限制，`crypto` 整体缺失时再退回 Math.random。
 */
export function createId(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}
