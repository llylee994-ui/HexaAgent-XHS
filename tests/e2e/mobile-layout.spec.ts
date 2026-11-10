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

const ACTION_BAR_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
]

/** 进入手动排盘并选好卦名，停在固定操作栏可见的状态 */
async function enterManualChart(page: import('@playwright/test').Page, question = '固定操作栏检查') {
  await page.goto('/')
  await page.getByRole('button', { name: '手动排盘' }).click()
  await page.getByLabel('你的问题').fill(question)
  await page.getByLabel('问题类别').selectOption('other')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('combobox', { name: '搜索卦名' }).fill('泰')
  await page.getByRole('option', { name: '地天泰' }).click()
}

for (const viewport of ACTION_BAR_VIEWPORTS) {
  test(`${viewport.width}px 宽度下固定操作栏滚动后仍贴在视口底部`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await enterManualChart(page)

    const actionBar = page.locator('.page-action-bar')
    await expect(actionBar).toBeVisible()
    const generate = page.getByRole('button', { name: '生成正式结果' })
    await expect(generate).toBeVisible()
    // 主操作只能有一个实例（原位置的内联按钮已删除）
    await expect(generate).toHaveCount(1)

    const before = await actionBar.boundingBox()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const after = await actionBar.boundingBox()

    expect(before?.y).toBe(after?.y)
    expect(await actionBar.evaluate((element) => getComputedStyle(element).position)).toBe('fixed')

    // 固定栏不得造成横向滚动
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)

    // 占位块生效：最后一个内容控件可以滚到固定栏上边缘之上，不被遮挡
    const lastInline = page.getByRole('button', { name: '恢复全部自动值' })
    const lastBox = await lastInline.boundingBox()
    const barBox = await actionBar.boundingBox()
    expect(lastBox).not.toBeNull()
    expect(barBox).not.toBeNull()
    expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(barBox!.y)
  })
}

test('固定操作栏的底部内边距包含安全区', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/')
  // 只能注入在应用内导航之前：真实设备由 WebView 提供同名变量，整页刷新会把它丢掉
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-area-inset-bottom', '11px')
  })
  await page.getByRole('button', { name: '手动排盘' }).click()
  await page.getByLabel('你的问题').fill('安全区检查')
  await page.getByLabel('问题类别').selectOption('other')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('combobox', { name: '搜索卦名' }).fill('泰')
  await page.getByRole('option', { name: '地天泰' }).click()

  const actionBar = page.locator('.page-action-bar')
  await expect(actionBar).toBeVisible()

  const paddingBottom = await actionBar.evaluate((element) => getComputedStyle(element).paddingBottom)
  // 12px 基础内边距 + 11px 安全区 = 23px
  expect(Number.parseFloat(paddingBottom)).toBeGreaterThanOrEqual(23)

  // 占位块随安全区增长，避免内容被固定栏盖住
  const spacerHeight = await page.locator('.page-action-bar__spacer').evaluate((element) => getComputedStyle(element).height)
  expect(Number.parseFloat(spacerHeight)).toBeGreaterThanOrEqual(107)
})
