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
