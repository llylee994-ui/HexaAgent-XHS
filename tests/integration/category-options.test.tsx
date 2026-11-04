import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { QuestionStep } from '../../src/features/cast/QuestionStep'
import { ManualPage } from '../../src/features/manual/ManualPage'

const labels = ['子女／晚辈', '父母／长辈', '兄弟姐妹／同辈']

describe('人物关系问题类别', () => {
  it('现场摇卦问题步骤展示三个类别和候选用神说明', () => {
    render(<QuestionStep onSubmit={() => {}} />)
    const select = screen.getByRole('combobox', { name: '问题类别' })
    for (const label of labels) expect(select).toHaveTextContent(label)
    expect(screen.getByText('类别用于推荐主用神候选，具体仍需结合问题确认。')).toBeTruthy()
  })

  it('手动排盘编辑页使用同一组选项', async () => {
    const user = userEvent.setup()
    render(<ManualPage onCaseCreated={() => {}} />)
    await user.type(screen.getByLabelText('你的问题'), '所问亲属近况如何')
    await user.selectOptions(screen.getByLabelText('问题类别'), 'children')
    await user.click(screen.getByRole('button', { name: '下一步' }))
    const select = screen.getByRole('combobox', { name: '问题类别' })
    for (const label of labels) expect(select).toHaveTextContent(label)
    expect(screen.getByText('类别用于推荐主用神候选，具体仍需结合问题确认。')).toBeTruthy()
  })
})
