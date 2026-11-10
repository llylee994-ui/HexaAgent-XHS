import { expect, test, type Page } from '@playwright/test'

/** 造一条真实卦例，再按它的形状复制 18 份，得到 19 条记录的长列表 */
async function seedLongList(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '手动排盘' }).click()
  await page.getByLabel('你的问题').fill('弹窗位置检查')
  await page.getByLabel('问题类别').selectOption('other')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('button', { name: '生成正式结果' }).click()
  await page.getByRole('button', { name: '返回首页' }).click()

  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('wenyao', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const source = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const request = db.transaction('cases', 'readonly').objectStore('cases').getAll()
      request.onsuccess = () => resolve(request.result[0] as Record<string, unknown>)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('cases', 'readwrite')
      for (let index = 0; index < 18; index += 1) {
        transaction.objectStore('cases').put({
          ...source,
          id: `long-list-${index}`,
          title: `长列表卦例 ${index}`,
          updatedAt: new Date(Date.now() - index * 1000).toISOString(),
        })
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  })
}

test('长记录列表中的删除确认框位于当前视口', async ({ page }) => {
  await seedLongList(page)

  await page.getByRole('button', { name: '卦例记录' }).click()
  await expect(page.getByRole('button', { name: '长列表卦例 0' })).toBeVisible()
  await page.getByRole('button', { name: '删除', exact: true }).first().click()

  const panel = await page.getByRole('dialog').locator('.confirm-dialog__panel').boundingBox()
  expect(panel).not.toBeNull()
  expect(panel!.y).toBeGreaterThanOrEqual(0)
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
})

test('320px 下全选批量删除清空长列表且无横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await seedLongList(page)

  await page.getByRole('button', { name: '卦例记录' }).click()
  await expect(page.getByRole('button', { name: '长列表卦例 0' })).toBeVisible()

  await page.getByRole('button', { name: '管理' }).click()
  await page.getByRole('button', { name: '全选' }).click()
  // 19 条 = 手动排盘生成的 1 条 + 复制出的 18 条
  await expect(page.getByRole('button', { name: '删除选中（19 条）' })).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)

  await page.getByRole('button', { name: '删除选中（19 条）' }).click()
  await page.getByRole('button', { name: '确认删除' }).click()

  await expect(page.getByText('还没有卦例，先从一次摇卦开始。')).toBeVisible()
  await expect(page.getByText('共 0 条记录')).toBeVisible()
})
