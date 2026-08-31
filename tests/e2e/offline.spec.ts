import { expect, test } from '@playwright/test'

const BASE = 'http://127.0.0.1:4173'

test('构建产物不发起任何外部请求，离线重载后核心流程可用', async ({ page }) => {
  const externalRequests: string[] = []
  const cache = new Map<string, { body: Buffer; contentType: string }>()
  let offline = false

  // 第一阶段：正常加载并缓存全部同源资源；同时记录任何外部请求
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== BASE) {
      externalRequests.push(route.request().url())
      return route.abort()
    }
    if (offline) {
      // 第二阶段：服务器不可达，只能从内存缓存满足
      const cached = cache.get(url.pathname)
      if (cached) {
        return route.fulfill({ body: cached.body, contentType: cached.contentType })
      }
      return route.abort()
    }
    const response = await route.fetch()
    cache.set(url.pathname, {
      body: await response.body(),
      contentType: response.headers()['content-type'] ?? 'text/html',
    })
    return route.fulfill({ response })
  })

  await page.goto('/')
  await expect(page.getByRole('button', { name: '手动排盘' })).toBeVisible()

  // 预取页面实际用到的全部资源（字体、chunk 等），进入离线阶段
  const resourceUrls = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => (entry as PerformanceResourceTiming).name)
      .filter((name) => name.startsWith('http://127.0.0.1:4173')),
  )
  for (const resourceUrl of resourceUrls) {
    await page.evaluate(async (url) => {
      await fetch(url)
    }, resourceUrl)
  }

  expect(externalRequests).toEqual([])

  // 缓存已预热：此后任何请求都不再触达服务器（模拟离线）
  offline = true
  await page.goto('/', { waitUntil: 'load' })

  await page.getByRole('button', { name: '手动排盘' }).click()
  await page.getByLabel('你的问题').fill('离线排盘')
  await page.getByLabel('问题类别').selectOption('study')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('combobox', { name: '搜索卦名' }).fill('乾')
  await page.getByRole('option', { name: '乾为天' }).click()
  await expect(page.getByText('本卦：乾为天', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '生成正式结果' }).click()
  await expect(page.getByText(/娱乐参考/)).toBeVisible()

  // 历史读取同样可用
  await page.getByRole('button', { name: '返回首页' }).click()
  await page.getByRole('button', { name: '卦例记录' }).click()
  await expect(page.getByRole('button', { name: /离线排盘/ })).toBeVisible()

  expect(externalRequests).toEqual([])
})
