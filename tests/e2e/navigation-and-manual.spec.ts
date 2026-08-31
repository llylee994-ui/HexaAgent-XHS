import { expect, test } from '@playwright/test'

test('controls expose focus, pressed and saved feedback', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '手动排盘' }).click()
  await page.getByLabel('你的问题').fill('交互反馈检查')
  await page.getByLabel('问题类别').selectOption('other')
  await page.getByRole('button', { name: '下一步' }).click()

  const frame = page.locator('.page-frame')
  await expect(frame).toHaveAttribute('data-direction', 'forward')
  await expect.poll(() => frame.locator('.page-frame__body').evaluate((element) => getComputedStyle(element).animationName)).not.toBe('none')

  const yang = page.getByRole('button', { name: '阳', exact: true }).first()
  await yang.click()
  await expect(yang).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect.poll(() => yang.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none')

  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByText('草稿已保存')).toBeVisible()
})

test('reduced motion removes page animation and control transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: '手动排盘' }).click()
  const frame = page.locator('.page-frame')
  await expect.poll(() => frame.locator('.page-frame__body').evaluate((element) => getComputedStyle(element).animationDuration)).toMatch(/0\.01ms|1e-05s|0s/)
  await expect.poll(() => frame.locator('.page-frame__body').evaluate((element) => getComputedStyle(element).transitionDuration)).toMatch(/0\.01ms|1e-05s|0s/)
})

test('searches, auto-fills, corrects, returns and generates structured prompt', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '手动排盘' }).click()
  await page.getByLabel('你的问题').fill('这次合作是否适合推进？')
  await page.getByLabel('问题类别').selectOption('career')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('combobox', { name: '搜索卦名' }).fill('泰')
  await page.getByRole('option', { name: '地天泰' }).click()
  await expect(page.getByText('本卦：地天泰')).toBeVisible()
  await page.getByRole('button', { name: '上爻动' }).click()
  await expect(page.getByText(/变卦：/)).toBeVisible()
  await page.getByRole('combobox', { name: '初爻六神' }).selectOption('玄武')
  await expect(page.getByText('人工校正')).toBeVisible()
  await page.getByRole('button', { name: '生成正式结果' }).click()
  await page.getByRole('button', { name: '生成专业版提示词' }).click()
  const prompt = page.getByLabel('提示词内容')
  await expect(prompt).toContainText('```json')
  await expect(prompt).toContainText('"original"')
  await page.getByRole('button', { name: '返回', exact: true }).click()
  await expect(page.getByRole('combobox', { name: '搜索卦名' })).toHaveValue('地天泰')
})

test('browser back restores history search state', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '卦例记录' }).click()
  await page.getByLabel('搜索卦例').fill('考试')
  await page.getByRole('button', { name: '搜索' }).click()
  await page.goBack()
  await expect(page.getByRole('heading', { name: '卦例记录' })).toBeVisible()
  await expect(page.getByLabel('搜索卦例')).toHaveValue('考试')
})
