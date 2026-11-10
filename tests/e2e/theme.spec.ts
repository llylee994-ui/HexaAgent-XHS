import { expect, test } from '@playwright/test'

const LIGHT_PAPER = 'rgb(245, 240, 232)'
const DARK_PAPER = 'rgb(26, 24, 21)'

test('未手动选择时跟随系统深浅色，且随系统实时变化', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('首页开关切换夜间模式，手动选择覆盖系统并持久化', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')

  const toggle = page.getByRole('button', { name: '夜间模式' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  // 手动选择之后不再跟随系统
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.getByRole('button', { name: '夜间模式' })).toHaveAttribute('aria-pressed', 'false')
})

test('夜间模式下底色与卡片变暗，容器状态栏同步且 320px 无横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')

  const ground = () => page.locator('html').evaluate((element) => getComputedStyle(element).backgroundColor)
  const card = () => page.locator('.entry-card').first().evaluate((element) => getComputedStyle(element).backgroundColor)
  const scheme = () =>
    page.evaluate(() => ({
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    }))

  await expect.poll(ground).toBe(LIGHT_PAPER)
  await expect.poll(card).toBe('rgba(255, 252, 246, 0.8)')
  expect((await scheme()).colorScheme).toBe('light')

  await page.getByRole('button', { name: '夜间模式' }).click()

  await expect.poll(ground).toBe(DARK_PAPER)
  await expect.poll(card).toBe('rgba(38, 34, 28, 0.8)')
  expect(await scheme()).toEqual({ colorScheme: 'dark', themeColor: '#1a1815' })

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  await expect(page.getByRole('button', { name: '现场摇卦' })).toBeVisible()
})
