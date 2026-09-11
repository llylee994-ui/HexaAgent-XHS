import { expect, test } from '@playwright/test'

/** 走完整链路：起一卦 → 导出备份文本 → 把文本改 id 后粘回 → 列表多出一条 */
test('导出备份并粘贴恢复', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '手动排盘' }).click()
  await page.getByLabel('你的问题').fill('备份用例')
  await page.getByLabel('问题类别').selectOption('other')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('combobox', { name: '搜索卦名' }).fill('乾')
  await page.getByRole('option', { name: '乾为天' }).click()
  await page.getByRole('button', { name: '生成正式结果' }).click()
  await page.getByRole('button', { name: '返回首页' }).click()
  await page.getByRole('button', { name: '卦例记录' }).click()

  await page.getByRole('button', { name: '展开导出备份' }).click()
  await page.getByRole('button', { name: '生成备份文本' }).click()

  const exportBox = page.getByLabel('备份文本')
  await expect(exportBox).toHaveValue(/问爻备份 v1/)
  const exported = await exportBox.inputValue()
  expect(exported).toContain('备份用例')

  await page.getByRole('button', { name: '全选内容' }).click()
  const selectedLength = await exportBox.evaluate(
    (element) =>
      (element as HTMLTextAreaElement).selectionEnd - (element as HTMLTextAreaElement).selectionStart,
  )
  expect(selectedLength).toBeGreaterThan(50)

  // 换一个 id 当作"另一台设备上恢复"，确保是新增而不是覆盖
  const restored = exported.replace(/"id":"[0-9a-f-]{36}"/, '"id":"e2e-restored-case"')
  expect(restored).toContain('e2e-restored-case')

  await page.getByRole('button', { name: '展开恢复备份' }).click()
  await page.getByLabel('粘贴备份文本').fill(restored)
  await page.getByRole('button', { name: '解析备份' }).click()
  await expect(page.getByText(/可恢复 1 条/)).toBeVisible()

  await page.getByRole('button', { name: '确认恢复' }).click()
  await page.getByRole('button', { name: '确认导入' }).click()
  await expect(page.getByText(/已恢复 1 条/)).toBeVisible()
  await expect(page.getByRole('button', { name: /备份用例/ })).toHaveCount(2)
})
