import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ManualPage } from '../../src/features/manual/ManualPage'
import { draftStore } from '../../src/storage/draft-store'

async function startManualEntry(user: ReturnType<typeof userEvent.setup>) {
  render(<ManualPage onCaseCreated={() => {}} />)
  await user.type(screen.getByLabelText('你的问题'), '考试能否通过')
  await user.selectOptions(screen.getByLabelText('问题类别'), 'study')
  await user.click(screen.getByRole('button', { name: '下一步' }))
}

describe('手动排盘流程', () => {
  it('直接录入 6/7/8/9 并实时预览本卦与变卦', async () => {
    const user = userEvent.setup()
    await startManualEntry(user)

    const values = ['6', '7', '7', '7', '7', '7']
    for (let i = 0; i < 6; i++) {
      await user.selectOptions(screen.getByLabelText(`第${i + 1}爻爻值`), values[i])
    }

    expect(screen.getByText('本卦：天风姤')).toBeTruthy()
    expect(screen.getByText('变卦：乾为天')).toBeTruthy()
  })

  it('阴阳与动静等价输入与直接录入结果一致', async () => {
    const user = userEvent.setup()
    await startManualEntry(user)

    // 第1爻 = 阴 + 动 → 6
    await user.click(screen.getByRole('button', { name: '第1爻阴' }))
    await user.click(screen.getByRole('button', { name: '第1爻动' }))
    expect((screen.getByLabelText('第1爻爻值') as HTMLSelectElement).value).toBe('6')

    // 其余五爻 = 阳 + 静 → 7
    for (let i = 2; i <= 6; i++) {
      await user.click(screen.getByRole('button', { name: `第${i}爻阳` }))
    }

    expect(screen.getByText('本卦：天风姤')).toBeTruthy()
    expect(screen.getByText('变卦：乾为天')).toBeTruthy()

    // 动静切换同步爻值：第2爻改动 → 9；第1爻老阴与第2爻老阳同时翻转，变卦变为天火同人
    await user.click(screen.getByRole('button', { name: '第2爻动' }))
    expect((screen.getByLabelText('第2爻爻值') as HTMLSelectElement).value).toBe('9')
    expect(screen.getByText('变卦：天火同人')).toBeTruthy()
  })

  it('专业字段默认折叠，展开后可覆盖起卦时间与六神', async () => {
    const user = userEvent.setup()
    const onCaseCreated = vi.fn()
    render(<ManualPage onCaseCreated={onCaseCreated} />)

    await user.type(screen.getByLabelText('你的问题'), '考试能否通过')
    await user.selectOptions(screen.getByLabelText('问题类别'), 'study')
    await user.click(screen.getByRole('button', { name: '下一步' }))

    expect(screen.queryByLabelText('起卦时间')).toBeNull()
    await user.click(screen.getByRole('button', { name: '展开专业编辑' }))
    expect(screen.getByLabelText('起卦时间')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('起卦时间'), {
      target: { value: '2026-08-28T12:00' },
    })
    await user.selectOptions(screen.getByLabelText('第1爻六神覆盖'), '玄武')

    const values = ['6', '7', '7', '7', '7', '7']
    for (let i = 0; i < 6; i++) {
      await user.selectOptions(screen.getByLabelText(`第${i + 1}爻爻值`), values[i])
    }

    await user.click(screen.getByRole('button', { name: '生成正式结果' }))
    expect(onCaseCreated).toHaveBeenCalledTimes(1)
    const result = onCaseCreated.mock.calls[0][0]
    expect(result.method).toBe('manual')
    expect(result.chart.original.lines[0].liushen).toBe('玄武')
    expect(result.chart.original.lines[0].overriddenFields).toContain('liushen')
    expect(result.chart.sizhu.day).toBe('甲戌')
  })

  it('输入不完整时允许保存草稿，但阻止生成正式结果并指出缺失字段', async () => {
    const user = userEvent.setup()
    await startManualEntry(user)

    for (let i = 0; i < 4; i++) {
      await user.selectOptions(screen.getByLabelText(`第${i + 1}爻爻值`), '7')
    }

    expect(screen.getByText('第 5、6 爻未填，暂不能生成正式结果')).toBeTruthy()
    const submit = screen.getByRole('button', { name: '生成正式结果' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    await user.click(screen.getByRole('button', { name: '保存草稿' }))
    expect(draftStore.load()?.rawValues).toEqual([7, 7, 7, 7])
  })
})
