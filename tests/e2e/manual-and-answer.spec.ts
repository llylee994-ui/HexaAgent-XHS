import { expect, test } from '@playwright/test'

test('一分钟内完成手动录入并保存两个 AI 回答', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: '手动排盘' }).click()
  await page.getByLabel('你的问题').fill('考试能否通过')
  await page.getByLabel('问题类别').selectOption('study')
  await page.getByRole('button', { name: '下一步' }).click()

  await page.getByLabel('第1爻爻值').selectOption('6')
  for (let i = 2; i <= 6; i++) {
    await page.getByLabel(`第${i}爻爻值`).selectOption('7')
  }
  await expect(page.getByText('本卦：天风姤')).toBeVisible()
  await expect(page.getByText('变卦：乾为天')).toBeVisible()

  await page.getByRole('button', { name: '生成正式结果' }).click()
  await expect(page.getByText('本卦：天风姤')).toBeVisible()

  // 经典参考离线显示本卦、动爻、变卦和六爻全文
  await page.getByRole('button', { name: '展开完整排盘' }).click()
  const reference = page.getByRole('region', { name: '卦爻参考' })
  await expect(reference.getByText('姤：女壮，勿用取女。')).toBeVisible()
  await expect(reference.getByRole('heading', { name: '本次动爻（1爻）' })).toBeVisible()
  await expect(reference.getByText('乾：元，亨，利，贞。')).toBeVisible()
  await expect(reference.getByText('白话').first()).toBeVisible()

  const allLines = reference.locator('details')
  await expect(allLines).not.toHaveAttribute('open', '')
  await allLines.getByText('查看全部爻辞').click()
  await expect(allLines.locator('.classic-line')).toHaveCount(6)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  // 专业版提示词包含完整排盘与七条约束（手动录入无投币记录，显示原始爻值）
  await page.getByRole('button', { name: '生成专业版提示词' }).click()
  const prompt = page.getByLabel('提示词内容')
  await expect(prompt).toContainText('原始爻值')
  await expect(prompt).toContainText('先确认用神选择')
  await expect(prompt).toContainText('健康、法律和财务')
  await page.getByRole('button', { name: '全选内容' }).click()

  // 两个来源的回答互不覆盖
  await page.getByRole('button', { name: '已问过 AI？粘贴回答' }).click()
  await page.getByLabel('粘贴 AI 回答').fill('第一个回答：总体平稳。')
  await page.getByLabel('AI 来源').selectOption('DeepSeek')
  await page.getByRole('button', { name: '保存回答' }).click()

  await page.getByRole('button', { name: '已问过 AI？粘贴回答' }).click()
  await page.getByLabel('粘贴 AI 回答').fill('第二个回答：注意文书细节。')
  await page.getByLabel('AI 来源').selectOption('ChatGPT')
  await page.getByRole('button', { name: '保存回答' }).click()

  await expect(page.getByText('第一个回答：总体平稳。')).toBeVisible()
  await expect(page.getByText('第二个回答：注意文书细节。')).toBeVisible()

  // 保存标题与后续验证
  await page.getByLabel('卦例标题').fill('考试第一卦')
  await page.getByLabel('后续验证').fill('通过了')
  await page.getByRole('button', { name: '保存卦例信息' }).click()

  // 历史页可见状态标签
  await page.getByRole('button', { name: '返回首页' }).click()
  await page.getByRole('button', { name: '卦例记录' }).click()
  await expect(page.getByText('考试第一卦')).toBeVisible()
  await expect(page.getByText('已补充后续验证')).toBeVisible()
})
