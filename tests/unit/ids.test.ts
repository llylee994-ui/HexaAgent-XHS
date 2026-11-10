import { webcrypto } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createId } from '../../src/domain/ids'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createId', () => {
  it('默认环境生成 UUID v4 形态且互不相同', () => {
    const id = createId()
    expect(id).toMatch(UUID_V4)
    expect(new Set(Array.from({ length: 50 }, () => createId())).size).toBe(50)
  })

  it('缺少 crypto.randomUUID（非安全上下文）时仍可用', () => {
    // 关键回归：容器用 http:// 或自定义 scheme 打开时 crypto.randomUUID 不存在，
    // 旧实现会让「现场摇卦」「手动排盘」两个入口点了毫无反应
    vi.stubGlobal('crypto', { getRandomValues: (array: Uint8Array) => webcrypto.getRandomValues(array) })

    const id = createId()
    expect(id).toMatch(UUID_V4)
  })

  it('crypto 整体缺失时退回 Math.random，不抛异常', () => {
    vi.stubGlobal('crypto', undefined)

    const id = createId()
    expect(id).toMatch(UUID_V4)
  })
})
