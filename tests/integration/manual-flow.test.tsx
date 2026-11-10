import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DivinationCase } from '../../src/domain/types'
import { createDraft } from '../../src/domain/factories'
import { ManualPage } from '../../src/features/manual/ManualPage'
import { manualDraftStore } from '../../src/features/manual/manual-draft-store'
import { draftStore } from '../../src/storage/draft-store'

beforeEach(() => localStorage.clear())

async function startManualEntry(user: ReturnType<typeof userEvent.setup>) {
  render(<ManualPage onCaseCreated={() => {}} />)
  await user.type(screen.getByLabelText('你的问题'), '考试能否通过')
  await user.selectOptions(screen.getByLabelText('问题类别'), 'study')
  await user.click(screen.getByRole('button', { name: '下一步' }))
}

/** 走完一轮未完成的手动排盘（已选卦名但未生成），然后卸载以模拟退出 */
async function enterAndLeaveUnfinishedManual(user: ReturnType<typeof userEvent.setup>, question = '没写完的手动排盘') {
  const { unmount } = render(<ManualPage onCaseCreated={() => {}} />)
  await user.type(screen.getByLabelText('你的问题'), question)
  await user.selectOptions(screen.getByLabelText('问题类别'), 'career')
  await user.click(screen.getByRole('button', { name: '下一步' }))
  await user.type(screen.getByRole('combobox', { name: '搜索卦名' }), '泰')
  await user.click(screen.getByRole('option', { name: '地天泰' }))
  unmount()
}

describe('专业手动排盘流程', () => {
  it('搜索地天泰后自动填充六神和世应，且不暴露内部爻值', async () => {
    const user = userEvent.setup()
    await startManualEntry(user)

    await user.type(screen.getByRole('combobox', { name: '搜索卦名' }), '泰')
    await user.click(screen.getByRole('option', { name: '地天泰' }))

    expect(screen.getByText('本卦：地天泰')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/六神$/)).toHaveLength(6)
    expect(screen.getAllByLabelText(/世应$/)).toHaveLength(6)
    expect(screen.queryByLabelText('第1爻爻值')).not.toBeInTheDocument()
  })

  it('允许校正初爻伏神并恢复自动值', async () => {
    const user = userEvent.setup()
    await startManualEntry(user)
    await user.click(screen.getByRole('button', { name: '编辑初爻伏神' }))
    await user.selectOptions(screen.getByLabelText('初爻伏神六亲'), '父母')
    await user.selectOptions(screen.getByLabelText('初爻伏神地支'), '亥')
    expect(screen.getByText('人工校正')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '恢复初爻自动值' }))
    expect(screen.queryByText('人工校正')).not.toBeInTheDocument()
  })

  it('标记上爻动时实时展示变卦，并且保存反馈就地出现', async () => {
    const user = userEvent.setup()
    await startManualEntry(user)
    await user.type(screen.getByRole('combobox', { name: '搜索卦名' }), '泰')
    await user.click(screen.getByRole('option', { name: '地天泰' }))
    await user.click(screen.getByRole('button', { name: '上爻动' }))
    expect(screen.getByText(/变卦：/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '保存草稿' }))
    expect(screen.getByText('草稿已保存')).toBeInTheDocument()
  })

  it('生成正式结果返回完整手动卦例，并保留可恢复草稿', async () => {
    const user = userEvent.setup()
    const onCaseCreated = vi.fn<(value: DivinationCase) => void>()
    render(<ManualPage onCaseCreated={onCaseCreated} />)
    await user.type(screen.getByLabelText('你的问题'), '这次合作是否适合推进？')
    await user.selectOptions(screen.getByLabelText('问题类别'), 'career')
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.type(screen.getByRole('combobox', { name: '搜索卦名' }), '泰')
    await user.click(screen.getByRole('option', { name: '地天泰' }))
    await user.click(screen.getByRole('button', { name: '生成正式结果' }))

    expect(onCaseCreated).toHaveBeenCalledOnce()
    expect(onCaseCreated.mock.calls[0][0].method).toBe('manual')
    expect(onCaseCreated.mock.calls[0][0].chart?.original.name).toBe('地天泰')
    expect(manualDraftStore.load()?.selectedHexagramName).toBe('地天泰')
  })

  it('卦名搜索入口使用强调文案和示例 placeholder', async () => {
    const user = userEvent.setup()
    await startManualEntry(user)

    const search = screen.getByRole('combobox', { name: '搜索卦名' })
    expect(search).toHaveAttribute('placeholder', '输入卦名，如：乾、风山渐')
    expect(screen.getByText('搜索并选择卦名')).toBeInTheDocument()
    // 搜索能力本身没有变化：仍然能按简称找到全名
    await user.type(search, '泰')
    expect(screen.getByRole('option', { name: '地天泰' })).toBeInTheDocument()
  })
})

describe('手动排盘的草稿恢复与重新开始', () => {
  it('未完成的草稿在重新进入时给出恢复提示与固定操作', async () => {
    const user = userEvent.setup()
    await enterAndLeaveUnfinishedManual(user)

    render(<ManualPage onCaseCreated={() => {}} />)

    expect(screen.getByRole('status')).toHaveTextContent('已恢复上次未完成的卦')
    expect(screen.getByRole('button', { name: '开始新一卦' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '生成正式结果' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '恢复全部自动值' })).toBeInTheDocument()
    // 草稿确实写进去了，底栏才可以说"已自动保存"
    expect(screen.getByText('当前内容已自动保存')).toBeInTheDocument()
  })

  it('存储不可用时底栏提示草稿未保存，而不是已自动保存', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    try {
      const user = userEvent.setup()
      render(<ManualPage onCaseCreated={() => {}} />)

      await user.type(screen.getByLabelText('你的问题'), '存储不可用也要提示')
      await user.selectOptions(screen.getByLabelText('问题类别'), 'career')
      await user.click(screen.getByRole('button', { name: '下一步' }))
      await user.type(screen.getByRole('combobox', { name: '搜索卦名' }), '泰')
      await user.click(screen.getByRole('option', { name: '地天泰' }))

      expect(screen.getByText('草稿未保存，请勿退出')).toBeInTheDocument()
      expect(screen.queryByText('当前内容已自动保存')).not.toBeInTheDocument()
      // 保存失败不影响继续编辑与生成
      expect(screen.getByRole('button', { name: '生成正式结果' })).toBeInTheDocument()
    } finally {
      setItem.mockRestore()
    }
  })

  it('取消开始新一卦会保留当前问题与卦象', async () => {
    const user = userEvent.setup()
    await enterAndLeaveUnfinishedManual(user)
    render(<ManualPage onCaseCreated={() => {}} />)

    await user.click(screen.getByRole('button', { name: '开始新一卦' }))
    expect(screen.getByRole('dialog', { name: '开始新一卦？' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '继续当前卦' }))

    expect(screen.getByLabelText('你的问题')).toHaveValue('没写完的手动排盘')
    expect(screen.getByText('本卦：地天泰')).toBeInTheDocument()
    expect(manualDraftStore.load()).not.toBeNull()
  })

  it('确认开始新一卦会清空手动草稿并回到空问题页', async () => {
    const user = userEvent.setup()
    await enterAndLeaveUnfinishedManual(user)
    render(<ManualPage onCaseCreated={() => {}} />)

    await user.click(screen.getByRole('button', { name: '开始新一卦' }))
    await user.click(screen.getByRole('button', { name: '清空并重新开始' }))

    expect(screen.getByLabelText('你的问题')).toHaveValue('')
    expect(screen.queryByRole('button', { name: '开始新一卦' })).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(manualDraftStore.load()).toBeNull()
  })

  it('清空手动草稿不会动到现场摇卦草稿', async () => {
    const user = userEvent.setup()
    const castDraft = createDraft({
      question: '现场摇卦的草稿',
      category: 'career',
      castAt: '2026-11-10T07:00:00.000Z',
      method: 'simulated-coins',
    })
    draftStore.save({ ...castDraft, rawValues: [7] })

    await enterAndLeaveUnfinishedManual(user)
    render(<ManualPage onCaseCreated={() => {}} />)

    await user.click(screen.getByRole('button', { name: '开始新一卦' }))
    await user.click(screen.getByRole('button', { name: '清空并重新开始' }))

    expect(manualDraftStore.load()).toBeNull()
    expect(draftStore.load()?.question).toBe('现场摇卦的草稿')
  })
})
