import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '../../src/components/ErrorBoundary'

afterEach(() => {
  vi.restoreAllMocks()
})

/** 渲染期抛异常：容器里没有错误边界时整棵树会被卸载，用户看到的是整页空白 */
function RenderBoom(): never {
  throw new Error('渲染期异常')
}

describe('顶层错误边界', () => {
  it('渲染期异常显示可重试界面而不是空白', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <RenderBoom />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('页面遇到异常')
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy()
  })

  it('effect 期异常同样被接住', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function EffectBoom() {
      useEffect(() => {
        throw new Error('effect 期异常')
      }, [])
      return <p>正常内容</p>
    }

    render(
      <ErrorBoundary>
        <EffectBoom />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByText('正常内容')).toBeNull()
  })

  it('点重试后恢复正常内容', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('一次性异常')
      return <p>恢复后的内容</p>
    }

    const user = userEvent.setup()
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()

    shouldThrow = false
    await user.click(screen.getByRole('button', { name: '重试' }))
    expect(screen.getByText('恢复后的内容')).toBeTruthy()
  })
})
