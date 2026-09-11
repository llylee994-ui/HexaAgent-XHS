import { expect, test } from '@playwright/test'

/**
 * 设备/容器时区不是东八区时，显示与排盘仍按北京时间。
 * 用 test.use 把浏览器上下文固定为 UTC（相当于海外设备），断言结果页显示的是
 * 北京时间而不是 UTC 墙钟，且手动排盘的时间输入回填同一时刻。
 */
test.use({ timezoneId: 'UTC' })

function beijingNowParts(): { text: string; inputValue: string } {
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const iso = shifted.toISOString()
  return { text: `${iso.slice(0, 10)} ${iso.slice(11, 16)}`, inputValue: iso.slice(0, 16) }
}

test('UTC 设备下结果页显示北京时间而不是 UTC 墙钟', async ({ page }) => {
  const { text } = beijingNowParts()

  await page.goto('/')
  await page.getByRole('button', { name: '现场摇卦' }).click()
  await page.getByLabel('你的问题').fill('时区显示检查')
  await page.getByLabel('问题类别').selectOption('other')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('button', { name: '模拟铜钱摇卦' }).click()
  for (let round = 0; round < 6; round += 1) {
    await page.getByRole('button', { name: '摇动铜钱' }).click()
  }
  await page.getByRole('button', { name: '生成结果' }).click()

  const meta = page.locator('.hero-card__meta')
  await expect(meta).toContainText('北京时间')
  // 北京时间与 UTC 相差 8 小时，若退化为 UTC 墙钟该断言必然失败
  await expect(meta).toContainText(text)
})

test('UTC 设备下手动排盘的时间输入按北京时间回填', async ({ page }) => {
  const { inputValue } = beijingNowParts()

  await page.goto('/')
  await page.getByRole('button', { name: '手动排盘' }).click()
  await page.getByLabel('你的问题').fill('时区回填检查')
  await page.getByLabel('问题类别').selectOption('other')
  await page.getByRole('button', { name: '下一步' }).click()

  const input = page.locator('input[aria-label="起卦时间"]')
  await expect(input).toBeVisible()
  await expect(input).toHaveValue(new RegExp(`^${inputValue.slice(0, 13)}`))
})
