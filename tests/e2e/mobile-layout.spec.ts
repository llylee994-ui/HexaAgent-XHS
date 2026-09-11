import { expect, test } from '@playwright/test'

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 430, height: 932 },
]

for (const viewport of VIEWPORTS) {
  test(`${viewport.width}px 宽度下无横向溢出且关键入口可见`, async ({ page }) => {
    await page.setViewportSize(viewport)

    const checkNoOverflow = async () => {
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth).toBeLessThanOrEqual(viewport.width)
    }

    // 首页
    await page.goto('/')
    await expect(page.getByRole('button', { name: '现场摇卦' })).toBeVisible()
    await checkNoOverflow()

    // 摇卦页
    await page.getByRole('button', { name: '现场摇卦' }).click()
    await expect(page.getByLabel('你的问题')).toBeVisible()
    await checkNoOverflow()

    // 手动排盘页
    await page.goto('/')
    await page.getByRole('button', { name: '手动排盘' }).click()
    await page.getByLabel('你的问题').fill('布局检查')
    await page.getByLabel('问题类别').selectOption('other')
    await page.getByRole('button', { name: '下一步' }).click()
    await page.getByRole('combobox', { name: '搜索卦名' }).fill('泰')
    await page.getByRole('option', { name: '地天泰' }).click()
    await expect(page.getByText('本卦：地天泰')).toBeVisible()
    await checkNoOverflow()

    // 历史页
    await page.goto('/')
    await page.getByRole('button', { name: '卦例记录' }).click()
    await expect(page.getByLabel('搜索卦例')).toBeVisible()
    await checkNoOverflow()
  })
}

test('320px 宽度下各页面标题完整显示', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })

  const expectCompactTitle = async (name: string) => {
    const title = page.getByRole('heading', { name, level: 1 })
    await expect(title).toBeVisible()
    const metrics = await title.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        fontSize: Number.parseFloat(style.fontSize),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }
    })
    expect(metrics.fontSize).toBeLessThanOrEqual(24)
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth)
  }

  await page.goto('/')
  await page.getByRole('button', { name: '现场摇卦' }).click()
  await expectCompactTitle('现场摇卦')

  await page.goto('/')
  await page.getByRole('button', { name: '手动排盘' }).click()
  await expectCompactTitle('手动排盘')

  await page.goto('/')
  await page.getByRole('button', { name: '卦例记录' }).click()
  await expectCompactTitle('卦例记录')

  await page.goto('/')
  await page.getByRole('button', { name: '现场摇卦' }).click()
  await page.getByLabel('你的问题').fill('标题布局检查')
  await page.getByLabel('问题类别').selectOption('other')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('button', { name: '模拟铜钱摇卦' }).click()
  for (let round = 0; round < 6; round += 1) {
    await page.getByRole('button', { name: '摇动铜钱' }).click()
  }
  await page.getByRole('button', { name: '生成结果' }).click()
  await expectCompactTitle('排盘结果')
})

test('PC 模拟器注入的安全区变量会参与页面内边距', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-area-inset-top', '18px')
    document.documentElement.style.setProperty('--safe-area-inset-right', '7px')
    document.documentElement.style.setProperty('--safe-area-inset-bottom', '11px')
    document.documentElement.style.setProperty('--safe-area-inset-left', '5px')
  })

  const padding = await page.locator('.app-shell').evaluate((element) => {
    const style = getComputedStyle(element)
    return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]
  })

  expect(padding).toEqual(['50px', '27px', '43px', '25px'])
})

test('减少动态效果模式下流程可用', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    Math.random = () => 0.1
  })
  await page.goto('/')
  await page.getByRole('button', { name: '现场摇卦' }).click()
  await page.getByLabel('你的问题').fill('减少动态测试')
  await page.getByLabel('问题类别').selectOption('other')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('button', { name: '模拟铜钱摇卦' }).click()
  await page.getByRole('button', { name: '摇动铜钱' }).click()
  await expect(page.getByText('第 2 爻 / 共六爻')).toBeVisible()
})
