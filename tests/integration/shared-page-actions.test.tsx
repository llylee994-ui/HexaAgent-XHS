import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DraftRecoveryNotice, PageActionBar } from '../../src/components'

describe('共享页面操作组件', () => {
  it('恢复提示使用确认过的完整文案', () => {
    render(<DraftRecoveryNotice />)
    expect(screen.getByRole('status')).toHaveTextContent(
      '已恢复上次未完成的卦，可以选择继续完成，也可以开始新一卦。',
    )
  })

  it('固定栏只承载一个次操作和一个主操作', () => {
    render(
      <PageActionBar
        secondary={<button type="button">开始新一卦</button>}
        primary={<button type="button">生成结果</button>}
        hint="当前内容已自动保存"
      />,
    )
    const region = screen.getByRole('region', { name: '页面操作' })
    expect(region).toContainElement(screen.getByRole('button', { name: '开始新一卦' }))
    expect(region).toContainElement(screen.getByRole('button', { name: '生成结果' }))
    expect(region).toHaveTextContent('当前内容已自动保存')
  })
})
