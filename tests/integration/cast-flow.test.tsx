import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CastPage } from '../../src/features/cast/CastPage'
import { draftStore } from '../../src/storage/draft-store'

beforeEach(() => {
  // 每次三枚铜钱都为正面（0.1 < 0.5），六轮全部为 9 老阳
  vi.spyOn(Math, 'random').mockReturnValue(0.1)
})

describe('现场摇卦流程', () => {
  it('先填问题与类别，再选择起卦方式，六轮后进入结果确认', async () => {
    const user = userEvent.setup()
    render(<CastPage onCaseCreated={() => {}} />)

    await user.type(screen.getByLabelText('你的问题'), '跳槽顺利吗')
    await user.selectOptions(screen.getByLabelText('问题类别'), 'career')
    await user.click(screen.getByRole('button', { name: '下一步' }))

    expect(screen.getByRole('button', { name: '模拟铜钱摇卦' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '现实投币录入' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '模拟铜钱摇卦' }))
    expect(screen.getByText('第 1 爻 / 共六爻')).toBeTruthy()

    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByRole('button', { name: '摇动铜钱' }))
    }
    expect(screen.getByText('本卦：乾为天')).toBeTruthy()
    expect(screen.getByText('变卦：坤为地')).toBeTruthy()
  })

  it('投币过程中可以撤销上一爻', async () => {
    const user = userEvent.setup()
    render(<CastPage onCaseCreated={() => {}} />)

    await user.type(screen.getByLabelText('你的问题'), '跳槽顺利吗')
    await user.selectOptions(screen.getByLabelText('问题类别'), 'career')
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '模拟铜钱摇卦' }))

    await user.click(screen.getByRole('button', { name: '摇动铜钱' }))
    await user.click(screen.getByRole('button', { name: '摇动铜钱' }))
    expect(screen.getByText('第 3 爻 / 共六爻')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '撤销上一爻' }))
    expect(screen.getByText('第 2 爻 / 共六爻')).toBeTruthy()
  })

  it('现实投币录入：按正反面换算爻值', async () => {
    const user = userEvent.setup()
    const onCaseCreated = vi.fn()
    render(<CastPage onCaseCreated={onCaseCreated} />)

    await user.type(screen.getByLabelText('你的问题'), '项目前景如何')
    await user.selectOptions(screen.getByLabelText('问题类别'), 'career')
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '现实投币录入' }))

    expect(screen.getAllByRole('button', { name: '确认本轮' })).toHaveLength(1)

    // 第一轮：一枚正面两枚反面 → 3+2+2 = 7
    await user.click(screen.getByRole('button', { name: '第一枚铜钱' }))
    await user.click(screen.getByRole('button', { name: '确认本轮' }))

    // 第二至六轮：默认三反 → 6
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole('button', { name: '确认本轮' }))
    }

    expect(screen.getByText('本卦：地雷复')).toBeTruthy()
    expect(screen.getByText('变卦：乾为天')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '生成结果' }))
    expect(onCaseCreated).toHaveBeenCalledTimes(1)
    const result = onCaseCreated.mock.calls[0][0]
    expect(result.method).toBe('physical-coins')
    expect(result.rawValues).toEqual([7, 6, 6, 6, 6, 6])
    expect(result.coinThrows[0].faces).toEqual([1, 0, 0])
    expect(result.chart.original.name).toBe('地雷复')
    expect(result.status).toBe('cast')
  })

  it('六爻完成后修改卦象必须二次确认', async () => {
    const user = userEvent.setup()
    render(<CastPage onCaseCreated={() => {}} />)

    await user.type(screen.getByLabelText('你的问题'), '跳槽顺利吗')
    await user.selectOptions(screen.getByLabelText('问题类别'), 'career')
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '模拟铜钱摇卦' }))
    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByRole('button', { name: '摇动铜钱' }))
    }

    await user.click(screen.getByRole('button', { name: '修改卦象' }))
    expect(screen.getByRole('dialog')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '确认修改' }))
    // 回到投币状态，可继续撤销
    expect(screen.getByRole('button', { name: '撤销上一爻' })).toBeTruthy()
    // 六爻仍在，固定栏必须给回“生成结果”，不能只剩一个点了没反应的“摇动铜钱”
    expect(screen.getAllByRole('button', { name: '生成结果' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '摇动铜钱' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '撤销上一爻' }))
    expect(screen.getByText('第 6 爻 / 共六爻')).toBeTruthy()
    // 撤销一爻后重新回到投币主操作
    expect(screen.getAllByRole('button', { name: '摇动铜钱' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '生成结果' })).not.toBeInTheDocument()
  })

  it('摇到一半退出后草稿可以恢复', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<CastPage onCaseCreated={() => {}} />)

    await user.type(screen.getByLabelText('你的问题'), '跳槽顺利吗')
    await user.selectOptions(screen.getByLabelText('问题类别'), 'career')
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '模拟铜钱摇卦' }))
    await user.click(screen.getByRole('button', { name: '摇动铜钱' }))
    await user.click(screen.getByRole('button', { name: '摇动铜钱' }))
    unmount()

    render(<CastPage onCaseCreated={() => {}} />)
    // 直接恢复到投币进度页：问题在进度头显示，已完成两爻
    expect(screen.getByText('跳槽顺利吗')).toBeTruthy()
    expect(screen.getByText('第 3 爻 / 共六爻')).toBeTruthy()
    expect(draftStore.load()?.rawValues).toEqual([9, 9])

    // 恢复提示与底部两个动作同时可见：继续摇卦 + 开始新一卦
    expect(screen.getByRole('status')).toHaveTextContent(
      '已恢复上次未完成的卦，可以选择继续完成，也可以开始新一卦。',
    )
    expect(screen.getByRole('button', { name: '开始新一卦' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '摇动铜钱' })).toBeInTheDocument()
  })

  it('进行中的现场摇卦只保留一个摇动铜钱主按钮', async () => {
    const user = userEvent.setup()
    render(<CastPage onCaseCreated={() => {}} />)

    await user.type(screen.getByLabelText('你的问题'), '跳槽顺利吗')
    await user.selectOptions(screen.getByLabelText('问题类别'), 'career')
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '模拟铜钱摇卦' }))

    expect(screen.getAllByRole('button', { name: '摇动铜钱' })).toHaveLength(1)
    // 保存成功时如实提示已自动保存
    expect(screen.getByText('当前内容已自动保存')).toBeInTheDocument()

    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByRole('button', { name: '摇动铜钱' }))
    }
    // 主操作从“摇动铜钱”切换为“生成结果”，且全页只有一个
    expect(screen.getAllByRole('button', { name: '生成结果' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '摇动铜钱' })).not.toBeInTheDocument()
  })

  it('全新空白问题页不显示开始新一卦', async () => {
    render(<CastPage onCaseCreated={() => {}} />)
    expect(screen.queryByRole('button', { name: '开始新一卦' })).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('恢复现实投币草稿后仍能确认本轮', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<CastPage onCaseCreated={() => {}} />)

    await user.type(screen.getByLabelText('你的问题'), '项目前景如何')
    await user.selectOptions(screen.getByLabelText('问题类别'), 'career')
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '现实投币录入' }))
    await user.click(screen.getByRole('button', { name: '确认本轮' }))
    unmount()

    render(<CastPage onCaseCreated={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('已恢复上次未完成的卦')
    expect(screen.getAllByRole('button', { name: '确认本轮' })).toHaveLength(1)
    // 现实投币的三枚铜钱仍可点击切换正反面
    expect(screen.getByRole('button', { name: '第一枚铜钱' })).toBeInTheDocument()
  })

  it('存储不可用时底栏提示草稿未保存，而不是已自动保存', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    try {
      const user = userEvent.setup()
      render(<CastPage onCaseCreated={() => {}} />)

      await user.type(screen.getByLabelText('你的问题'), '存储不可用也要提示')
      await user.selectOptions(screen.getByLabelText('问题类别'), 'career')
      await user.click(screen.getByRole('button', { name: '下一步' }))
      await user.click(screen.getByRole('button', { name: '模拟铜钱摇卦' }))

      expect(screen.getByText('草稿未保存，请勿退出')).toBeInTheDocument()
      expect(screen.queryByText('当前内容已自动保存')).not.toBeInTheDocument()
      // 保存失败不能让流程卡住，仍可继续摇卦
      await user.click(screen.getByRole('button', { name: '摇动铜钱' }))
      expect(screen.getByText('第 2 爻 / 共六爻')).toBeInTheDocument()
      expect(screen.getByText('草稿未保存，请勿退出')).toBeInTheDocument()
    } finally {
      setItem.mockRestore()
    }
  })

  it('清空恢复中的现场摇卦后回到全新问题页', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<CastPage onCaseCreated={() => {}} />)

    await user.type(screen.getByLabelText('你的问题'), '跳槽顺利吗')
    await user.selectOptions(screen.getByLabelText('问题类别'), 'career')
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '模拟铜钱摇卦' }))
    await user.click(screen.getByRole('button', { name: '摇动铜钱' }))
    await user.click(screen.getByRole('button', { name: '摇动铜钱' }))
    unmount()

    render(<CastPage onCaseCreated={() => {}} />)
    expect(screen.getByText('第 3 爻 / 共六爻')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '开始新一卦' }))
    expect(screen.getByRole('dialog', { name: '开始新一卦？' })).toBeInTheDocument()
    // 先取消：当前进度必须原样保留
    await user.click(screen.getByRole('button', { name: '继续当前卦' }))
    expect(screen.getByText('第 3 爻 / 共六爻')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '开始新一卦' }))
    await user.click(screen.getByRole('button', { name: '清空并重新开始' }))
    expect(screen.getByLabelText('你的问题')).toHaveValue('')
    expect(screen.queryByRole('button', { name: '开始新一卦' })).not.toBeInTheDocument()
    expect(draftStore.load()).toBeNull()
  })

  it('恢复草稿后完成摇卦：保留最初的开始时刻，起卦时刻取第六爻完成时刻', async () => {
    const user = userEvent.setup()
    const onCaseCreated = vi.fn()
    const { unmount } = render(<CastPage onCaseCreated={onCaseCreated} />)

    await user.type(screen.getByLabelText('你的问题'), '跳槽顺利吗')
    await user.selectOptions(screen.getByLabelText('问题类别'), 'career')
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '模拟铜钱摇卦' }))
    await user.click(screen.getByRole('button', { name: '摇动铜钱' }))
    await user.click(screen.getByRole('button', { name: '摇动铜钱' }))

    const startedAt = draftStore.load()?.castStartedAt
    expect(typeof startedAt).toBe('string')
    unmount()

    render(<CastPage onCaseCreated={onCaseCreated} />)
    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole('button', { name: '摇动铜钱' }))
    }
    await user.click(screen.getByRole('button', { name: '生成结果' }))

    const result = onCaseCreated.mock.calls[0][0]
    // 恢复过程不覆盖最初的开始时刻
    expect(result.castStartedAt).toBe(startedAt)
    // 得卦时刻在第六爻完成时确定，且不早于开始时刻
    expect(Date.parse(result.castAt)).toBeGreaterThanOrEqual(Date.parse(result.castStartedAt))
    expect(result.chart.sizhu).toBeDefined()
  })

  it('生成结果回调完整卦例并清理草稿', async () => {
    const user = userEvent.setup()
    const onCaseCreated = vi.fn()
    render(<CastPage onCaseCreated={onCaseCreated} />)

    await user.type(screen.getByLabelText('你的问题'), '跳槽顺利吗')
    await user.selectOptions(screen.getByLabelText('问题类别'), 'career')
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '模拟铜钱摇卦' }))
    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByRole('button', { name: '摇动铜钱' }))
    }
    await user.click(screen.getByRole('button', { name: '生成结果' }))

    const result = onCaseCreated.mock.calls[0][0]
    expect(result.method).toBe('simulated-coins')
    expect(result.rawValues).toEqual([9, 9, 9, 9, 9, 9])
    expect(result.coinThrows).toHaveLength(6)
    expect(result.chart.original.name).toBe('乾为天')
    expect(result.chart.changed?.name).toBe('坤为地')
    expect(result.chart.allChanging).toBe(true)
    expect(draftStore.load()).toBeNull()
  })
})
