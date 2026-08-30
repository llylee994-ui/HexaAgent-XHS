# 卦辞爻辞与原创白话实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为问爻补齐六十四卦卦辞、384 条常规爻辞、乾坤用九/用六及原创白话，并在结果页按本卦、动爻和变卦上下文离线展示。

**Architecture:** 经典文本放在独立 `src/content/classics` 模块，按文王卦序每八卦拆分一个数据文件，通过标准卦名与现有六十四卦引擎连接。`ReferenceText` 只消费查询 API，不直接依赖数据文件；原文、原创白话和六爻动态初判保持三个独立语义层。

**Tech Stack:** React 19、TypeScript 6、Vitest、Testing Library、原生 HTML `details/summary`、CSS；运行时零网络请求。

## Global Constraints

- 只收录卦辞、六条爻辞、乾坤用九/用六，不收录《彖传》《象传》《文言传》《系辞传》。
- 古典原文至少对照两个可信来源；现代网站或书籍译文不得复制。
- 白话由本项目原创，解释处境与提醒，不输出确定性预测，不硬编码爱情、事业、财运吉凶。
- 数据全部进入本地静态产物，不使用 `fetch`、外链、动态下载或外部字体。
- 卦名必须与 `HEXAGRAM_TABLE` 的 64 个标准名称一一对应。
- 六爻数组按初爻到上爻排序，位置固定为 `1..6`。
- 缺失内容安全降级，结果页不得崩溃。
- 每个行为变更遵循红—绿—重构循环，提交前运行对应验证命令。

---

## 文件结构

```text
src/content/classics/
├── types.ts                  经典文本类型
├── index.ts                  数据汇总、查找和动爻筛选 API
└── data/
    ├── 01-08.ts              乾至比
    ├── 09-16.ts              小畜至豫
    ├── 17-24.ts              随至复
    ├── 25-32.ts              无妄至恒
    ├── 33-40.ts              遁至解
    ├── 41-48.ts              损至井
    ├── 49-56.ts              革至旅
    └── 57-64.ts              巽至未济
tests/unit/classics.test.ts   数据完整性和查询行为
tests/integration/result-flow.test.tsx
src/features/result/ReferenceText.tsx
src/styles/global.css
docs/classics-sources.md
docs/implementation-status.md
```

---

### Task 1: 经典文本契约与查询 API

**Files:**
- Create: `src/content/classics/types.ts`
- Create: `src/content/classics/index.ts`
- Test: `tests/unit/classics.test.ts`

**Interfaces:**
- Produces: `ClassicPassage`、`ClassicLine`、`HexagramClassicText`。
- Produces: `HEXAGRAM_CLASSICS: readonly HexagramClassicText[]`。
- Produces: `getHexagramClassic(name: string): HexagramClassicText | null`。
- Produces: `getRelevantClassicLines(name: string, positions: readonly LinePosition[]): readonly ClassicLine[]`。

- [ ] **Step 1: 写查询 API 失败测试**

  测试未知卦名返回 `null`，乾卦可按 `[1, 6]` 返回“初九”“上九”且顺序按爻位排列；重复或乱序输入 `[6, 1, 1]` 返回去重后的初、上两爻。

```ts
expect(getHexagramClassic('不存在的卦')).toBeNull()
expect(getRelevantClassicLines('乾为天', [6, 1, 1]).map((line) => line.label))
  .toEqual(['初九', '上九'])
```

- [ ] **Step 2: 运行测试确认失败**

  Run: `npm test -- tests/unit/classics.test.ts`

  Expected: FAIL，原因是 `src/content/classics` 尚不存在。

- [ ] **Step 3: 实现类型和最小查询 API**

  `ClassicLine` 继承 `ClassicPassage` 并增加 `position`、`label`；`HexagramClassicText.lines` 使用六元素只读元组。`index.ts` 汇总数据文件，构建标准卦名 Map，并在模块初始化时拒绝重复名称。

- [ ] **Step 4: 运行目标测试**

  Run: `npm test -- tests/unit/classics.test.ts`

  Expected: 查询测试通过；完整性测试在语料未补齐前保持失败。

- [ ] **Step 5: 提交契约**

  Run: `git add src/content/classics tests/unit/classics.test.ts && git commit -m "feat: define hexagram classics content contract"`

---

### Task 2: 六十四卦原文与原创白话语料

**Files:**
- Create: `src/content/classics/data/01-08.ts`
- Create: `src/content/classics/data/09-16.ts`
- Create: `src/content/classics/data/17-24.ts`
- Create: `src/content/classics/data/25-32.ts`
- Create: `src/content/classics/data/33-40.ts`
- Create: `src/content/classics/data/41-48.ts`
- Create: `src/content/classics/data/49-56.ts`
- Create: `src/content/classics/data/57-64.ts`
- Create: `docs/classics-sources.md`
- Modify: `tests/unit/classics.test.ts`

**Interfaces:**
- Consumes: `HexagramClassicText`。
- Produces: 文王卦序 1–64 的完整本地语料；每卦一条卦辞、六条爻辞及白话；乾坤各一个特殊条目。

- [ ] **Step 1: 写语料完整性失败测试**

  断言恰好 64 卦、卦序为 1–64、名称集合等于 `HEXAGRAM_TABLE` 名称集合、每卦六条爻位为 `[1,2,3,4,5,6]`、所有 `original/plain` 去空白后非空、只有乾卦 `use-nine` 与坤卦 `use-six`。

```ts
expect(HEXAGRAM_CLASSICS).toHaveLength(64)
expect(HEXAGRAM_CLASSICS.map((item) => item.sequence)).toEqual(
  Array.from({ length: 64 }, (_, index) => index + 1),
)
expect(new Set(HEXAGRAM_CLASSICS.map((item) => item.name))).toEqual(engineNames)
```

- [ ] **Step 2: 运行测试确认语料缺失**

  Run: `npm test -- tests/unit/classics.test.ts`

  Expected: FAIL，报告缺少卦、爻或文本。

- [ ] **Step 3: 建立来源记录并校验古典原文**

  `docs/classics-sources.md` 记录两个原文来源、访问日期、采用的简体字与标点策略、常见异文处理原则。逐卦录入卦辞和爻辞；原文不得从现代译文反向生成。

- [ ] **Step 4: 撰写原创白话并分批录入**

  每段白话使用 1–3 句解释场景、行动条件和风险；不出现“保证”“必然”“一定成功”“一定失败”“确诊”。按 1–8、9–16、17–24、25–32、33–40、41–48、49–56、57–64 八个文件录入，确保原文与白话相邻，便于人工核对。

- [ ] **Step 5: 增加文案安全测试**

  遍历所有白话，断言不含确定性禁语，并验证原文与白话不是相同字符串，防止漏写解释。

- [ ] **Step 6: 运行语料测试并提交**

  Run: `npm test -- tests/unit/classics.test.ts`

  Expected: 64 卦、384 条爻辞、用九、用六及全部白话通过。

  Run: `git add src/content/classics/data src/content/classics/index.ts tests/unit/classics.test.ts docs/classics-sources.md && git commit -m "feat: add offline Zhouyi classic corpus"`

---

### Task 3: 结果页经典文本展示

**Files:**
- Modify: `src/features/result/ReferenceText.tsx`
- Modify: `src/styles/global.css`
- Modify: `tests/integration/result-flow.test.tsx`

**Interfaces:**
- Consumes: `getHexagramClassic()`、`getRelevantClassicLines()`、`HexagramChart`。
- Produces: 本卦卦辞、动爻、全部爻辞折叠区、乾坤特殊条目、变卦卦辞和安全降级 UI。

- [ ] **Step 1: 写结果页失败测试**

  使用现有天风姤初爻动案例，展开完整排盘后断言：显示天风姤卦辞原文和白话；突出“初六”原文和白话；“查看全部爻辞”默认折叠；显示乾为天变卦卦辞；页面仍显示“不等同于六爻纳甲综合判断”。

- [ ] **Step 2: 写静卦和降级失败测试**

  直接渲染 `ReferenceText`，静卦断言无“本次动爻”区；未知卦名断言显示“该卦经典文本暂缺”且保留卦宫摘要。

- [ ] **Step 3: 运行测试确认失败**

  Run: `npm test -- tests/integration/result-flow.test.tsx`

  Expected: FAIL，现有组件仍显示“后续版本补充”。

- [ ] **Step 4: 实现上下文展示**

  使用语义化 `article`、`blockquote`、`details/summary`。本卦卦辞始终显示；动爻卡按爻位排序；全部爻辞默认折叠；变卦只显示卦辞；原文标记“原文”，白话标记“白话”。

- [ ] **Step 5: 增加移动端样式**

  动爻卡使用朱砂色左边线，原文使用宋体栈，白话使用正文栈；段落允许自然换行，`summary` 点击区至少 44px；不增加图片、字体或外部资源。

- [ ] **Step 6: 运行测试并提交**

  Run: `npm test -- tests/integration/result-flow.test.tsx tests/unit/classics.test.ts`

  Expected: 全部通过。

  Run: `git add src/features/result/ReferenceText.tsx src/styles/global.css tests/integration/result-flow.test.tsx && git commit -m "feat: show classic texts in divination results"`

---

### Task 4: 发布门禁与状态文档

**Files:**
- Modify: `tests/e2e/manual-and-answer.spec.ts`
- Modify: `docs/implementation-status.md`

**Interfaces:**
- Produces: 结果页经典文本的移动端 E2E 保障和更新后的完成状态。

- [ ] **Step 1: 增加 E2E 断言**

  在手动排盘结果中展开完整排盘，断言卦辞原文、白话标签和“查看全部爻辞”可见；展开全部爻辞后断言至少六个爻辞条目，页面无横向溢出。

- [ ] **Step 2: 更新状态文档**

  从“已知降级项”移除卦爻辞未迁移，记录经典文本范围、原创白话原则、来源文档位置和测试数量；不得把《彖传》《象传》标记为已完成范围。

- [ ] **Step 3: 运行完整验证**

  Run: `npm run lint && npm test && npm run build && npx playwright test`

  Expected: Lint 0 问题；全部单元/集成测试通过；构建扫描 `0 violations`；全部 E2E 通过。

- [ ] **Step 4: 检查离线产物**

  Run: `node scripts/verify-xhs-build.mjs dist`

  Expected: `0 violations`，经典文本包含于包内资源，无外部 URL 或网络 API。

- [ ] **Step 5: 提交发布更新**

  Run: `git add tests/e2e/manual-and-answer.spec.ts docs/implementation-status.md && git commit -m "test: verify offline classic references"`

---

## 最终验收清单

- [ ] 六十四卦名称、卦序与引擎表完全对应。
- [ ] 64 条卦辞、384 条常规爻辞、用九、用六均有古典原文和原创白话。
- [ ] 静卦不擅自指定爻辞，动卦只突出本卦实际动爻。
- [ ] 变卦只展示整体卦辞，不误标为本次动爻。
- [ ] 全部爻辞可折叠浏览，移动端无横向溢出。
- [ ] 不包含现代分类吉凶断语或确定性预测禁语。
- [ ] 缺失内容安全降级，结果页不崩溃。
- [ ] 所有内容离线打包，构建扫描 0 违规。
