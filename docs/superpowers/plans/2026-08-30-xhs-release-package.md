# 问爻小红书发布包 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 生成可直接上传小红书小工具后台的“问爻”离线 ZIP、512×512 图标、上架简介和可复核的发布摘要。

**Architecture:** 保持 React 应用和业务数据不变，在 Vite 构建后增加一个确定性的经典脚本转换步骤，再以独立扫描器按官方白名单校验目录。PowerShell 发布脚本只压缩已验证的 `dist` 内容，并重新打开 ZIP 检查根入口、扩展名、体积和文件一致性；图标作为后台素材单独交付，不进入运行 ZIP。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest、Playwright、Node.js ESM、PowerShell/.NET ZipArchive、内置 ImageGen。

## Global Constraints

- 最终规则来源为 `.codex/SKILL.md`（`minitool-zip-builder` 1.4.0）及其 `references/`。
- ZIP 根目录必须直接包含 `index.html`，不能包含 `dist/` 外层目录。
- 运行包仅允许 `html/css/js/png/jpg/jpeg/gif/webp/svg/woff/woff2/json` 扩展名。
- 所有脚本必须是外置经典脚本；禁止内联脚本、`type="module"`、`modulepreload`、`import`、`export` 和 `import.meta`。
- 禁止网络 API、远程资源、Worker、Service Worker、WebAssembly、动态代码执行、iframe、下载、剪贴板、定位、传感器和新窗口能力。
- 所有运行资源必须使用 `./` 相对路径，且引用文件必须存在。
- 视口必须包含 `width=device-width`、`initial-scale=1.0` 和 `viewport-fit=cover`。
- ZIP 不能超过 10MB，目标小于 2MB。
- 不接入 JSBridge；当前版本只使用 IndexedDB/localStorage 等容器允许的本地能力。
- 图标固定输出为 512×512 PNG，不放进运行 ZIP。
- `release/` 只存放生成产物，不提交 Git。

---

### Task 1: 经典脚本构建后处理

**Files:**
- Create: `scripts/prepare-xhs-build.mjs`
- Create: `tests/unit/prepare-xhs-build.test.ts`
- Modify: `vite.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Vite 生成的 `dist/index.html` 与 `dist/assets/*.js`。
- Produces: `prepareXhsBuild(root: string): Promise<{ entry: string }>`；输出 HTML 中唯一入口为 `<script defer src="./assets/..."></script>`，且不含 module-preload polyfill。

- [ ] **Step 1: 写转换成功的失败测试**

```ts
it('converts the single Vite module entry into a deferred classic script', async () => {
  const root = await makeBuild('<script type="module" crossorigin src="./assets/app.js"></script>')
  await expect(prepareXhsBuild(root)).resolves.toEqual({ entry: './assets/app.js' })
  await expect(readFile(join(root, 'index.html'), 'utf8')).resolves.toContain(
    '<script defer src="./assets/app.js"></script>',
  )
})
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `npm test -- tests/unit/prepare-xhs-build.test.ts`
Expected: FAIL，错误指向无法导入 `prepare-xhs-build.mjs`。

- [ ] **Step 3: 写入口数量错误的失败测试**

```ts
it.each([
  ['zero', '<main></main>'],
  ['multiple', '<script type="module" src="./a.js"></script><script type="module" src="./b.js"></script>'],
])('rejects %s module entries', async (_name, html) => {
  const root = await makeBuild(html)
  await expect(prepareXhsBuild(root)).rejects.toThrow(/exactly one module entry/i)
})
```

- [ ] **Step 4: 实现最小确定性转换器**

```js
export async function prepareXhsBuild(root) {
  const indexPath = resolve(root, 'index.html')
  const html = await readFile(indexPath, 'utf8')
  const entries = [...html.matchAll(/<script\b([^>]*\btype=["']module["'][^>]*)><\/script>/gi)]
  if (entries.length !== 1) throw new Error(`Expected exactly one module entry, found ${entries.length}`)
  const src = entries[0][1].match(/\bsrc=["']([^"']+)["']/i)?.[1]
  if (!src?.startsWith('./')) throw new Error('Module entry must use a ./ relative path')
  const nextHtml = html.replace(entries[0][0], `<script defer src="${src}"></script>`)
  await writeFile(indexPath, nextHtml)
  return { entry: src }
}
```

- [ ] **Step 5: 关闭 Vite module-preload polyfill 并接入构建链**

```ts
export default defineConfig({
  base: './',
  build: { modulePreload: { polyfill: false } },
  plugins: [react()],
  publicDir: false,
})
```

将 `package.json` 的构建命令改为：

```json
"build": "tsc -b && vite build && node scripts/prepare-xhs-build.mjs dist && npm run verify:xhs"
```

- [ ] **Step 6: 运行目标测试和生产构建**

Run: `npm test -- tests/unit/prepare-xhs-build.test.ts && npm run build`
Expected: 测试通过；`dist/index.html` 只有一个 `defer` 经典脚本入口，构建退出码为 0。

- [ ] **Step 7: 提交任务**

```bash
git add scripts/prepare-xhs-build.mjs tests/unit/prepare-xhs-build.test.ts vite.config.ts package.json
git commit -m "build: emit classic xhs entry script"
```

### Task 2: 官方小工具目录校验器

**Files:**
- Modify: `scripts/verify-xhs-build.mjs`
- Modify: `tests/unit/verify-xhs-build.test.ts`

**Interfaces:**
- Consumes: 任意待上传目录路径。
- Produces: `scanBuild(root: string): Promise<Violation[]>`；`Violation` 为 `{ file: string; rule: string; match: string }`，命令行有违规时退出码为 1。

- [ ] **Step 1: 写目录结构与文件白名单失败测试**

```ts
it('rejects a missing root index, extra html, and unsupported files', async () => {
  const root = await makeRoot()
  await writeFile(join(root, 'other.html'), '<!doctype html>')
  await writeFile(join(root, 'debug.map'), '{}')
  expect((await scanBuild(root)).map(({ rule }) => rule)).toEqual(
    expect.arrayContaining(['missing-root-index', 'extra-html', 'unsupported-extension']),
  )
})
```

- [ ] **Step 2: 运行测试并确认新规则缺失**

Run: `npm test -- tests/unit/verify-xhs-build.test.ts`
Expected: FAIL，实际规则列表不含三个新规则。

- [ ] **Step 3: 写 HTML 契约失败测试**

```ts
it('rejects module scripts, inline scripts, invalid viewport, and non-relative assets', async () => {
  const html = '<meta name="viewport" content="width=device-width"><script type="module" src="/app.js"></script>'
  const rules = (await scanFixture(html)).map(({ rule }) => rule)
  expect(rules).toEqual(expect.arrayContaining([
    'module-script', 'invalid-viewport', 'absolute-resource-path', 'missing-resource',
  ]))
})
```

- [ ] **Step 4: 写禁用能力与模块语法失败测试**

```ts
it.each([
  ['network-api', 'fetch("./data.json")'],
  ['module-syntax', 'export const value = 1'],
  ['clipboard', 'navigator.clipboard.writeText("x")'],
  ['geolocation', 'navigator.geolocation.getCurrentPosition(ok)'],
  ['sensor', 'new DeviceMotionEvent("x")'],
  ['new-window', 'window.open("./x")'],
])('reports %s', async (rule, source) => {
  expect(await scanScript(source)).toContainEqual(expect.objectContaining({ rule }))
})
```

- [ ] **Step 5: 实现文件清单、HTML 引用和内容规则扫描**

实现以下精确行为：递归列出全部文件；保留全部文件用于白名单检查、只对文本扩展名读取 UTF-8；根 `index.html` 必须存在且仅允许这一个 HTML；解析 `script[src]`、`link[href]`、`img[src]` 等本地引用并验证 `./` 与存在性；逐项加入官方禁用能力规则；仅豁免 `https://react.dev/errors/` 错误文案和 `http://www.w3.org/2000/svg` DOM namespace 常量。

- [ ] **Step 6: 运行目标测试，构建并扫描真实产物**

Run: `npm test -- tests/unit/verify-xhs-build.test.ts && npm run build && node scripts/verify-xhs-build.mjs dist`
Expected: 测试通过；真实 `dist` 输出 `0 violations`。

- [ ] **Step 7: 提交任务**

```bash
git add scripts/verify-xhs-build.mjs tests/unit/verify-xhs-build.test.ts
git commit -m "test: enforce xhs package constraints"
```

### Task 3: ZIP 打包和发布摘要

**Files:**
- Create: `scripts/package-xhs.ps1`
- Modify: `.gitignore`
- Modify: `docs/xhs-review-guide.md`

**Interfaces:**
- Consumes: 已通过 `npm run verify:xhs` 的 `dist/`、版本号和可选图标路径。
- Produces: `release/wenyao-xhs-0.1.0.zip`、`release/release-summary.md`；摘要包含名称、简介、UTC+08:00 构建时间、字节数、SHA-256、ZIP 文件清单和检查结果。

- [ ] **Step 1: 先写脚本自检模式并观察失败**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-xhs.ps1 -DistPath fixtures/missing -OutputPath release/wenyao-xhs-0.1.0.zip`
Expected: FAIL，明确报告找不到根 `index.html`，且不生成 ZIP。

- [ ] **Step 2: 实现只压缩 dist 内容的发布脚本**

脚本使用 `Resolve-Path` 固定输入目录，用 `Compress-Archive -Path (Join-Path $dist '*')` 生成 ZIP；随后用 `[System.IO.Compression.ZipFile]::OpenRead()` 重新检查：根 `index.html`、无 `dist/` 包裹、无目录穿越、扩展名白名单、总大小不超过 10MB、条目集合与 `dist` 相同。任一步失败时删除本次未通过的 ZIP 并返回非零退出码。

- [ ] **Step 3: 生成可审计摘要**

脚本通过 `Get-FileHash -Algorithm SHA256`、ZIP 条目和已知文案生成 Markdown；摘要中的简介必须逐字为：

> 离线六爻起卦与排盘记录工具，支持模拟摇卦、现实投币和手动排盘，提供卦爻原文、白话参考、卦例记录与 AI 提示词整理。数据仅保存在本机，不上传云端。内容仅供传统文化研究与娱乐参考。

- [ ] **Step 4: 忽略生成目录并更新审核指南**

在 `.gitignore` 加入 `release/`。在 `docs/xhs-review-guide.md` 记录：先运行 `npm run build`，再运行发布脚本；本地预览对象必须是处理后的 `dist`；之后才上传 PC 模拟器和真机。

- [ ] **Step 5: 运行发布脚本并复检 ZIP**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-xhs.ps1`
Expected: 生成 ZIP 与摘要；ZIP 小于 2MB；根目录直接包含 `index.html`；ZIP 文件集合与 `dist` 完全一致。

- [ ] **Step 6: 提交任务**

```bash
git add scripts/package-xhs.ps1 .gitignore docs/xhs-review-guide.md
git commit -m "build: package verified xhs release"
```

### Task 4: 图标、离线预览和最终发布门禁

**Files:**
- Create (generated, ignored): `release/wenyao-icon-512.png`
- Create (generated, ignored): `release/wenyao-xhs-0.1.0.zip`
- Create (generated, ignored): `release/release-summary.md`
- Modify only if a failing regression requires it: `tests/e2e/*.spec.ts`

**Interfaces:**
- Consumes: Task 1–3 的处理后 `dist`、发布脚本和已确认图标视觉方向。
- Produces: 可上传的三项发布产物及完整验证证据。

- [ ] **Step 1: 用内置 ImageGen 生成图标**

Prompt:

```text
Use case: logo-brand
Asset type: Xiaohongshu mini-tool app icon, final square raster asset
Primary request: Create a restrained Chinese divination icon for an app named “问爻”.
Scene/backdrop: warm ivory handmade-paper texture, nearly flat and clean
Subject: one bold cinnabar-red abstract six-line hexagram mark, arranged like a compact square seal
Style/medium: minimal editorial Chinese seal design, crisp edges, premium but quiet
Composition/framing: centered, generous safe margin, readable at 32px, no border touching the canvas
Color palette: warm ivory and cinnabar red only
Constraints: exact square composition; no letters or Chinese text; no gradients; no neon; no photo; no shadows; no watermark; no tiny details
```

- [ ] **Step 2: 保存并检查图标**

把 ImageGen 最终输出复制到 `release/wenyao-icon-512.png`；若原图不是 512×512，仅做等比居中裁切和高质量缩放，不重绘内容。用图像查看工具确认主体清晰、边距安全、无文字水印，并用文件元数据确认 PNG 与 512×512。

- [ ] **Step 3: 运行最终产物的离线浏览器测试**

Run: `npm run build && npm run test:e2e`
Expected: 应用从处理后的生产 `dist` 正常加载；320/375/430px 无横向溢出；页面发起 0 个外部 HTTP(S) 请求；核心摇卦和查看结果流程通过。

- [ ] **Step 4: 重新生成最终 ZIP 和摘要**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-xhs.ps1 -IconPath release/wenyao-icon-512.png`
Expected: 摘要记录图标尺寸、ZIP SHA-256、体积、文件清单和全部门禁结果；运行 ZIP 中不包含图标。

- [ ] **Step 5: 运行全量新鲜验证**

Run: `npm run lint && npm test && npm run build && npm run test:e2e && powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-xhs.ps1 -IconPath release/wenyao-icon-512.png`
Expected: 全部命令退出码为 0；Vitest 与 Playwright 均 0 失败；扫描器输出 `0 violations`；ZIP 小于 2MB。

- [ ] **Step 6: 对照规格进行逐项复核**

重新阅读 `docs/superpowers/specs/2026-08-30-xhs-release-package-design.md` 和 `.codex/SKILL.md`，逐项核对摘要；运行 `git status --short` 确认仅有预期源码/文档变更，`release/` 未进入 Git。

- [ ] **Step 7: 提交测试或文档修正并交付路径**

若离线回归新增测试，提交：

```bash
git add tests/e2e docs/superpowers/plans/2026-08-30-xhs-release-package.md
git commit -m "test: verify offline xhs release"
```

最终交付三个绝对路径，并明确下一步是将 ZIP 与图标上传小红书 PC 模拟器，按 `docs/xhs-review-guide.md` 继续真机验收。
