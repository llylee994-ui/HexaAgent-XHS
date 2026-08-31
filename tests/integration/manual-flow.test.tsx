import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DivinationCase } from '../../src/domain/types'
import { ManualPage } from '../../src/features/manual/ManualPage'
import { manualDraftStore } from '../../src/features/manual/manual-draft-store'

beforeEach(() => localStorage.clear())

async function startManualEntry(user: ReturnType<typeof userEvent.setup>) {
  render(<ManualPage onCaseCreated={() => {}} />)
  await user.type(screen.getByLabelText('你的问题'), '考试能否通过')
  await user.selectOptions(screen.getByLabelText('问题类别'), 'study')
  await user.click(screen.getByRole('button', { name: '下一步' }))
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
})
