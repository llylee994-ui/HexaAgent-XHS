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
    await user.click(screen.getByRole('button', { name: '撤销上一爻' }))
    expect(screen.getByText('第 6 爻 / 共六爻')).toBeTruthy()
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
