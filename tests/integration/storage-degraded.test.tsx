import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import 'fake-indexeddb/auto'

/**
 * 容器禁用本机存储时的降级：不能白屏，且保存失败必须让用户看见。
 * 静态 import 的 App 会在模块求值阶段就创建仓库，所以这里必须先把 indexedDB 换掉再动态引入。
 */
describe('容器禁用 IndexedDB', () => {
  it('应用仍能进入并完成摇卦，只是保存失败会显示提示', async () => {
    vi.stubGlobal('indexedDB', undefined)
    vi.resetModules()
    const { default: App } = await import('../../src/app/App')
    try {
      const user = userEvent.setup()
      render(<App />)

      // 旧实现会在模块求值阶段抛错，首页直接白屏
      expect(await screen.findByRole('heading', { name: '问爻' })).toBeInTheDocument()
      expect(screen.getByText('最近卦例加载失败，请稍后重试。')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '手动排盘' }))
      await user.type(screen.getByLabelText('你的问题'), '存储不可用也要能走完')
      await user.selectOptions(screen.getByLabelText('问题类别'), 'other')
      await user.click(screen.getByRole('button', { name: '下一步' }))
      await user.click(screen.getByRole('button', { name: '生成正式结果' }))

      expect(await screen.findByRole('heading', { name: '排盘结果' })).toBeInTheDocument()
      // 保存失败不能再是"点了没反应"
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('本次修改没有保存')
      expect(alert).toHaveTextContent('本机存储不可用')
    } finally {
      vi.unstubAllGlobals()
      vi.resetModules()
    }
  })
})
