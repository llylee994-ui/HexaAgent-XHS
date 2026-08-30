import { expect, test } from '@playwright/test'

// 每次投币都为正面（0.1 < 0.5），六轮全部为 9 老阳，保证结果可复现
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.1
  })
})

test('三分钟内完成模拟摇卦、生成提示词、保存回答并刷新恢复', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: '现场摇卦' }).click()
  await page.getByLabel('你的问题').fill('跳槽顺利吗')
  await page.getByLabel('问题类别').selectOption('career')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('button', { name: '模拟铜钱摇卦' }).click()

  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: '摇动铜钱' }).click()
  }
  await expect(page.getByText('本卦：乾为天')).toBeVisible()
  await expect(page.getByText('变卦：坤为地')).toBeVisible()

  await page.getByRole('button', { name: '生成结果' }).click()
  await expect(page.getByText('这条卦例还没有保存 AI 解读')).toBeVisible()
  await expect(page.getByText(/娱乐参考/)).toBeVisible()

  // 生成提示词并全选
  await page.getByRole('button', { name: '生成精简版提示词' }).click()
  const prompt = page.getByLabel('提示词内容')
  await expect(prompt).toContainText('跳槽顺利吗')
  await page.getByRole('button', { name: '全选内容' }).click()
  const selection = await prompt.evaluate(
    (element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart,
  )
  expect(selection).toBeGreaterThan(0)

  // 粘贴回答
  await page.getByRole('button', { name: '已问过 AI？粘贴回答' }).click()
  await page.getByLabel('粘贴 AI 回答').fill('测试解读：信号复杂，建议观望。')
  await page.getByLabel('AI 来源').selectOption('DeepSeek')
  await page.getByRole('button', { name: '保存回答' }).click()
  await expect(page.getByText('测试解读：信号复杂，建议观望。')).toBeVisible()
  await expect(page.getByText('这条卦例还没有保存 AI 解读')).toHaveCount(0)

  // 刷新后数据仍在：首页最近卦例可重新打开
  await page.reload()
  await page.getByRole('button', { name: /跳槽顺利吗/ }).click()
  await expect(page.getByText('本卦：乾为天', { exact: true })).toBeVisible()
  await expect(page.getByText('测试解读：信号复杂，建议观望。')).toBeVisible()
})

test('历史页搜索到已保存卦例', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '现场摇卦' }).click()
  await page.getByLabel('你的问题').fill('搬家合适吗')
  await page.getByLabel('问题类别').selectOption('other')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('button', { name: '模拟铜钱摇卦' }).click()
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: '摇动铜钱' }).click()
  }
  await page.getByRole('button', { name: '生成结果' }).click()

  await page.getByRole('button', { name: '返回首页' }).click()
  await page.getByRole('button', { name: '卦例记录' }).click()
  await page.getByLabel('搜索卦例').fill('搬家')
  await page.getByRole('button', { name: '搜索' }).click()

  await expect(page.getByRole('button', { name: /搬家合适吗/ })).toBeVisible()
})
