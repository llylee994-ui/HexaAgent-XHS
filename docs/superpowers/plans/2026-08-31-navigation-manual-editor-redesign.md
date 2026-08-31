# 问爻导航与专业手动排盘实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将问爻升级为具有应用内返回栈、平滑页面过渡、全组件互动反馈和自动优先专业手动排盘的离线小红书小工具，并增强专业 AI 提示词的结构化数据。

**Architecture:** 保持现有 React、TypeScript、原生 CSS、IndexedDB 与本地排盘引擎。新增一个独立导航栈 hook 和统一页面框架；新增手动排盘纯函数模型、草稿快照与移动端编辑组件；所有派生排盘字段统一由 `buildChart` 计算，人工校正通过扩展后的 `ChartOverrides` 最后合并。专业提示词的可读文本和 JSON 从同一 `DivinationCase` 生成。

**Tech Stack:** React 19、TypeScript 6、Vite 8、原生 CSS、Vitest、Testing Library、Playwright、localStorage、IndexedDB。

## Global Constraints

- 完整设计规格：`docs/superpowers/specs/2026-08-31-navigation-manual-editor-redesign.md`。
- 业务参考实现：`D:\HexaAgent\frontend\src\components\HexagramEditor.tsx`、`SearchableSelect.tsx`、`YaoLineRow.tsx`、`stores/useChatStore.ts`，只迁移业务行为，不复制桌面对话外壳。
- “6/7/8/9”不得作为手动排盘的可见输入，只能作为内部 `RawYaoValue`。
- 六亲、地支、六神、世应与伏神以自动推导为默认，人工编辑只用于校正。
- 页面运行时不得联网，不得引入外部字体、CDN、模块脚本或新增小红书禁用能力。
- 动画只修改 `transform` 和 `opacity`，持续 180-240ms，并支持 `prefers-reduced-motion`。
- 320px、375px、430px 宽度不得产生横向溢出。
- 保持现有 `DivinationCase` 与 IndexedDB 记录兼容；手动编辑临时状态使用独立草稿快照，不提高卦例 schema 版本。
- 所有新行为按测试先行开发；每个任务完成后运行该任务测试并提交一次。

---

## File Map

### 新建文件

- `src/app/use-navigation-stack.ts`：应用内导航栈、前进/返回方向和浏览器 `popstate` 协调。
- `src/components/PageFrame.tsx`：统一页面顶部栏、返回按钮、状态区与页面过渡容器。
- `src/features/manual/model.ts`：手动编辑状态、阴阳动静映射、卦名预设、预览和完整性校验纯函数。
- `src/features/manual/catalog.ts`：六十四卦目录、片段搜索与卦名到静态爻值的转换。
- `src/features/manual/manual-draft-store.ts`：手动编辑草稿快照的 localStorage 持久化。
- `src/features/manual/use-manual-editor.ts`：组合问题、四柱、六爻、覆盖值、状态反馈和草稿保存。
- `src/features/manual/HexagramSearch.tsx`：可访问的卦名搜索下拉。
- `src/features/manual/SizhuEditor.tsx`：起卦时间、四柱、空亡和自动填充状态。
- `src/features/manual/YaoEditor.tsx`：上爻到初爻的移动端两行编辑器。
- `src/features/manual/YaoEditorRow.tsx`：单爻自动值、人工校正、伏神与恢复操作。
- `src/features/manual/ManualValidationSummary.tsx`：分区错误与第一个错误定位。
- `src/engines/prompt/structured.ts`：从卦例生成稳定的专业提示词 JSON。
- `tests/unit/manual-model.test.ts`：手动编辑纯函数与自动推导测试。
- `tests/unit/manual-draft-store.test.ts`：手动草稿兼容与恢复测试。
- `tests/unit/prompt-structured.test.ts`：可读排盘与 JSON 一致性测试。
- `tests/integration/navigation-flow.test.tsx`：应用内返回和页面状态恢复测试。
- `tests/e2e/navigation-and-manual.spec.ts`：移动端专业排盘、返回与结构化提示词主流程，在 Task 5 建立交互骨架并于 Task 7 补全。

### 修改文件

- `src/app/App.tsx`、`src/app/navigation.ts`。
- `src/components/index.tsx`。
- `src/domain/types.ts`。
- `src/engines/najia/chart.ts`。
- `src/engines/prompt/engine.ts`、`src/engines/prompt/formatter.ts`、`src/domain/versions.ts`。
- `src/features/home/HomePage.tsx`。
- `src/features/cast/CastPage.tsx`。
- `src/features/manual/ManualPage.tsx`。
- `src/features/history/HistoryPage.tsx`。
- `src/features/result/ResultPage.tsx`、`src/features/result/FullChart.tsx`、`src/features/result/PromptPanel.tsx`。
- `src/styles/tokens.css`、`src/styles/global.css`。
- `tests/unit/chart.test.ts`、`tests/unit/prompt.test.ts`。
- `tests/integration/manual-flow.test.tsx`、`tests/integration/history-flow.test.tsx`、`tests/integration/result-flow.test.tsx`。
- `tests/e2e/manual-and-answer.spec.ts`、`tests/e2e/mobile-layout.spec.ts`、`docs/xhs-review-guide.md`。

---

### Task 1: 应用内导航栈与统一返回

**Files:**
- Create: `src/app/use-navigation-stack.ts`
- Create: `src/components/PageFrame.tsx`
- Create: `tests/integration/navigation-flow.test.tsx`
- Modify: `src/app/navigation.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/components/index.tsx`
- Modify: `src/features/home/HomePage.tsx`
- Modify: `src/features/cast/CastPage.tsx`
- Modify: `src/features/history/HistoryPage.tsx`
- Modify: `src/features/result/ResultPage.tsx`

**Interfaces:**
- Produces:

```ts
export type Route = 'home' | 'cast' | 'manual' | 'result' | 'history'
export type NavigationDirection = 'forward' | 'back'

export interface HistoryViewState {
  query: string
  scrollY: number
}

export interface NavigationEntry {
  key: string
  route: Route
  activeCaseId?: string
  history?: HistoryViewState
  scrollY: number
}

export interface NavigationStack {
  current: NavigationEntry
  direction: NavigationDirection
  canGoBack: boolean
  push(entry: Omit<NavigationEntry, 'key'>): void
  updateCurrent(patch: Partial<NavigationEntry>): void
  back(): void
}

export function useNavigationStack(initialRoute?: Route): NavigationStack
```

- `PageFrame` props:

```ts
export interface PageFrameProps {
  title: string
  canGoBack?: boolean
  direction?: NavigationDirection
  status?: string
  onBack?(): void
  children: React.ReactNode
}
```

- `HistoryPage` gains `initialQuery?: string` and `onViewStateChange?(state: HistoryViewState): void`.
- `ResultPage.onBack` means “previous page”, while a separate `onHome` handles the explicit “返回首页”.

- [ ] **Step 1: Write failing navigation tests**

Create `tests/integration/navigation-flow.test.tsx` with real `App` behavior. The production break caught by these tests is replacing every return action with `setRoute('home')` or losing history state when the page unmounts.

```tsx
it('returns from manual to home without exiting the application', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: '手动排盘' }))
  expect(screen.getByRole('heading', { name: '手动排盘' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '返回' }))
  expect(screen.getByRole('heading', { name: '问爻' })).toBeInTheDocument()
})

it('restores the history query after viewing a result and returning', async () => {
  const repository = createCaseRepository()
  await repository.put(buildCase({ title: '考试第一卦', question: '考试是否顺利？' }))
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: '卦例记录' }))
  await user.type(screen.getByLabelText('搜索卦例'), '考试')
  await user.click(screen.getByRole('button', { name: /考试第一卦/ }))
  await user.click(screen.getByRole('button', { name: '返回' }))
  expect(screen.getByLabelText('搜索卦例')).toHaveValue('考试')
})

it('maps browser popstate to one internal back operation', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: '现场摇卦' }))
  act(() => window.dispatchEvent(new PopStateEvent('popstate')))
  expect(screen.getByRole('heading', { name: '问爻' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Verify the navigation tests fail for the current router**

Run:

```powershell
npm test -- tests/integration/navigation-flow.test.tsx
```

Expected: failures because no shared “返回” header exists, history query is local-only, and `popstate` is not handled.

- [ ] **Step 3: Implement the navigation stack**

Implement `useNavigationStack` with a React state array and one browser history marker per internal push. Use a stable `popstate` listener with cleanup. `back()` must call the same internal pop function as `popstate` and must not create a second history entry.

```ts
const HOME_ENTRY: NavigationEntry = {
  key: 'home',
  route: 'home',
  scrollY: 0,
}

function popStack(stack: readonly NavigationEntry[]): NavigationEntry[] {
  return stack.length > 1 ? stack.slice(0, -1) : stack
}
```

Use `PageFrame` on every non-home page. Remove page-bottom buttons whose only purpose is “返回首页”; retain one explicit home action on the result page as a secondary action.

- [ ] **Step 4: Restore history query and scroll state**

Lift history query state through `HistoryPage.initialQuery` and `onViewStateChange`. Before opening a result, save `query` and `window.scrollY` into the current navigation entry. After returning, restore the query immediately and scroll after render with `requestAnimationFrame`.

- [ ] **Step 5: Run navigation and existing integration tests**

Run:

```powershell
npm test -- tests/integration/navigation-flow.test.tsx tests/integration/history-flow.test.tsx tests/integration/result-flow.test.tsx tests/integration/cast-flow.test.tsx
```

Expected: all pass.

- [ ] **Step 6: Commit Task 1**

```powershell
git add src/app src/components src/features/home src/features/cast src/features/history src/features/result tests/integration/navigation-flow.test.tsx tests/integration/history-flow.test.tsx tests/integration/result-flow.test.tsx tests/integration/cast-flow.test.tsx
git commit -m "feat: add application navigation stack"
```

---

### Task 2: 手动排盘纯函数模型与六十四卦搜索

**Files:**
- Create: `src/features/manual/model.ts`
- Create: `src/features/manual/catalog.ts`
- Create: `tests/unit/manual-model.test.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/engines/najia/chart.ts`
- Modify: `tests/unit/chart.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ManualLineInput {
  position: LinePosition
  type: YinYang
  changing: boolean
}

export interface ManualEditorState {
  question: string
  category: QuestionCategory | ''
  note: string
  castAt: string
  rawValues: readonly RawYaoValue[]
  overrides: ChartOverrides
  selectedHexagramName: string
}

export interface ManualValidationIssue {
  section: 'question' | 'sizhu' | 'lines'
  position?: LinePosition
  field?: string
  message: string
}

export function rawValueFromLine(type: YinYang, changing: boolean): RawYaoValue
export function lineFromRawValue(value: RawYaoValue): Pick<ManualLineInput, 'type' | 'changing'>
export function rawValuesForHexagram(name: string): readonly RawYaoValue[]
export function searchHexagrams(query: string): readonly HexagramTableEntry[]
export function buildManualChart(state: ManualEditorState): HexagramChart
export function validateManualState(state: ManualEditorState): readonly ManualValidationIssue[]
export function clearLineOverride(overrides: ChartOverrides, position: LinePosition): ChartOverrides
```

- Extend `OverrideField` with `'fushen'`.
- Extend `ChartLineOverrides` with `fushen?: Fushen | null`.

- [ ] **Step 1: Write failing mapping, catalog, override and validation tests**

```ts
it.each([
  ['yin', true, 6],
  ['yang', false, 7],
  ['yin', false, 8],
  ['yang', true, 9],
] as const)('maps %s changing=%s to raw value %s', (type, changing, expected) => {
  expect(rawValueFromLine(type, changing)).toBe(expected)
})

it('finds 地天泰 by full name and by 泰', () => {
  expect(searchHexagrams('地天泰').map((item) => item.name)).toEqual(['地天泰'])
  expect(searchHexagrams('泰').map((item) => item.name)).toContain('地天泰')
})

it('creates the static 地天泰 lines without exposing coin values to the UI', () => {
  expect(rawValuesForHexagram('地天泰')).toEqual([7, 7, 7, 8, 8, 8])
})

it('applies and records a manual fushen correction', () => {
  const chart = buildChart([7, 7, 7, 8, 8, 8], new Date('2026-08-31T03:00:00.000Z'), {
    lines: { 1: { fushen: { liuqin: '父母', zhi: '亥' } } },
  })
  expect(chart.original.lines[0].fushen).toEqual({ liuqin: '父母', zhi: '亥' })
  expect(chart.original.lines[0].overriddenFields).toContain('fushen')
})

it('requires exactly one shi and one ying in the final chart', () => {
  const state = buildValidManualState({
    overrides: { lines: { 1: { shiYing: 'shi' }, 2: { shiYing: 'shi' } } },
  })
  expect(validateManualState(state)).toContainEqual(
    expect.objectContaining({ section: 'lines', field: 'shiYing' }),
  )
})
```

- [ ] **Step 2: Verify the pure-model tests fail**

Run:

```powershell
npm test -- tests/unit/manual-model.test.ts tests/unit/chart.test.ts
```

Expected: failures because the catalog API, visible mapping API,伏神覆盖和完整性校验尚不存在。

- [ ] **Step 3: Implement catalog and raw-value mapping**

Build the catalog from `HEXAGRAM_TABLE.values()` and sort by the table insertion order. Convert an entry into static raw values by concatenating `trigramLines(lower)` then `trigramLines(upper)`, mapping yin to 8 and yang to 7.

```ts
export function rawValuesForHexagram(name: string): readonly RawYaoValue[] {
  const entry = [...HEXAGRAM_TABLE.values()].find((item) => item.name === name)
  if (!entry) throw new Error(`未知卦名: ${name}`)
  return [...trigramLines(entry.lowerTrigram), ...trigramLines(entry.upperTrigram)]
    .map((type) => rawValueFromLine(type, false))
}
```

- [ ] **Step 4: Extend chart overrides without duplicating engine logic**

Apply `fushen` after automatic `attachFushen`, add `'fushen'` to `overriddenFields`, and ensure removing a line override restores the automatic伏神、六亲、六神和世应。 Do not move automatic calculations into React components.

- [ ] **Step 5: Implement final-state validation**

`validateManualState` must build the final chart and validate chart output. It must not infer “manual effort” from whether an override exists. If building fails, return a section-specific issue and preserve the state.

- [ ] **Step 6: Run the unit suite**

```powershell
npm test -- tests/unit/manual-model.test.ts tests/unit/chart.test.ts tests/unit/hexagram-engine.test.ts tests/unit/najia.test.ts tests/unit/calendar.test.ts
```

Expected: all pass.

- [ ] **Step 7: Commit Task 2**

```powershell
git add src/features/manual/model.ts src/features/manual/catalog.ts src/domain/types.ts src/engines/najia/chart.ts tests/unit/manual-model.test.ts tests/unit/chart.test.ts
git commit -m "feat: add automatic manual chart model"
```

---

### Task 3: 独立手动草稿与编辑会话

**Files:**
- Create: `src/features/manual/manual-draft-store.ts`
- Create: `src/features/manual/use-manual-editor.ts`
- Create: `tests/unit/manual-draft-store.test.ts`
- Modify: `src/features/manual/ManualPage.tsx`
- Modify: `tests/integration/manual-flow.test.tsx`

**Interfaces:**

```ts
export interface ManualDraftSnapshot extends ManualEditorState {
  version: 1
  caseId: string
  openFushen: readonly LinePosition[]
  updatedAt: string
}

export interface ManualDraftStore {
  load(): ManualDraftSnapshot | null
  save(snapshot: ManualDraftSnapshot): void
  clear(): void
}

export interface ManualEditorController {
  state: ManualEditorState
  chart: HexagramChart | null
  issues: readonly ManualValidationIssue[]
  status: 'idle' | 'auto-filled' | 'corrected' | 'saved' | 'error'
  selectHexagram(name: string): void
  setLine(position: LinePosition, patch: Partial<ManualLineInput>): void
  setLineOverride(position: LinePosition, patch: ChartLineOverrides): void
  restoreLine(position: LinePosition): void
  restoreAll(): void
  saveDraft(): void
  complete(): DivinationCase | null
}
```

- [ ] **Step 1: Write failing draft and restoration tests**

```ts
it('round-trips overrides, selected hexagram and open fushen rows', () => {
  const snapshot = buildManualDraft({
    selectedHexagramName: '地天泰',
    openFushen: [1, 4],
    overrides: { lines: { 1: { liushen: '青龙' } } },
  })
  manualDraftStore.save(snapshot)
  expect(manualDraftStore.load()).toEqual(snapshot)
})

it('leaves an invalid stored draft untouched by the current case database', () => {
  localStorage.setItem('wenyao:manual-editor-draft:v1', '{bad json')
  expect(manualDraftStore.load()).toBeNull()
  expect(caseRepository.listEntries()).resolves.toEqual([])
})
```

Add integration coverage that enters a question, selects a hexagram, navigates to result, returns, and sees the same question and selected hexagram.

- [ ] **Step 2: Verify draft tests fail**

```powershell
npm test -- tests/unit/manual-draft-store.test.ts tests/integration/manual-flow.test.tsx
```

Expected: failures because current manual flow stores only partial `DivinationCase` data and clears state after completion.

- [ ] **Step 3: Implement versioned manual draft storage**

Use the exact key `wenyao:manual-editor-draft:v1`. Parse defensively and reject snapshots with wrong version, fewer or more than six raw values, invalid ISO time, or unknown卦名. Do not alter `SCHEMA_VERSION`.

- [ ] **Step 4: Implement `useManualEditor`**

Keep calculations in Task 2 pure functions. The hook owns React state, autosave, transient status text and completion. `complete()` validates first; only a valid result clears the manual draft. Returning from result must not clear it until the user starts a new manual case or explicitly discards it.

- [ ] **Step 5: Replace `useCaseSession` usage in `ManualPage`**

Keep `useCaseSession` unchanged for coin-casting pages. Move the manual page to `useManualEditor` so professional fields and UI state restore independently.

- [ ] **Step 6: Run focused tests**

```powershell
npm test -- tests/unit/manual-draft-store.test.ts tests/integration/manual-flow.test.tsx tests/integration/cast-flow.test.tsx
```

Expected: all pass and the cast flow remains unchanged.

- [ ] **Step 7: Commit Task 3**

```powershell
git add src/features/manual/manual-draft-store.ts src/features/manual/use-manual-editor.ts src/features/manual/ManualPage.tsx tests/unit/manual-draft-store.test.ts tests/integration/manual-flow.test.tsx
git commit -m "feat: persist professional manual editor drafts"
```

---

### Task 4: 移动端专业手动排盘界面

**Files:**
- Create: `src/features/manual/HexagramSearch.tsx`
- Create: `src/features/manual/SizhuEditor.tsx`
- Create: `src/features/manual/YaoEditor.tsx`
- Create: `src/features/manual/YaoEditorRow.tsx`
- Create: `src/features/manual/ManualValidationSummary.tsx`
- Modify: `src/features/manual/ManualPage.tsx`
- Delete after replacement: `src/features/manual/QuickEntry.tsx`
- Delete after replacement: `src/features/manual/ProfessionalEditor.tsx`
- Modify: `tests/integration/manual-flow.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Components consume `ManualEditorController`; none reimplement纳甲、六亲、六神、世应或伏神算法。
- `HexagramSearch.onSelect(name)` passes a catalog name only.
- `YaoEditorRow` receives one final automatic `YaoLine`, its raw input, line overrides and correction callbacks.

- [ ] **Step 1: Replace current integration expectations with failing professional-editor behavior**

The production breaks caught here are reintroducing the numeric selector, making derived fields manual-only, or hiding世应 and伏神.

```tsx
it('searches 地天泰 and automatically fills derived line fields', async () => {
  const user = userEvent.setup()
  renderManualPage()
  await enterQuestion(user)
  await user.type(screen.getByRole('combobox', { name: '搜索卦名' }), '泰')
  await user.click(screen.getByRole('option', { name: '地天泰' }))
  expect(screen.getByText('本卦：地天泰')).toBeInTheDocument()
  expect(screen.getAllByLabelText(/六神$/)).toHaveLength(6)
  expect(screen.getAllByLabelText(/世应$/)).toHaveLength(6)
  expect(screen.queryByLabelText('第1爻爻值')).not.toBeInTheDocument()
})

it('allows a fushen correction and restores the automatic value', async () => {
  const user = userEvent.setup()
  renderReadyManualPage()
  await user.click(screen.getByRole('button', { name: '编辑初爻伏神' }))
  await user.selectOptions(screen.getByLabelText('初爻伏神六亲'), '父母')
  await user.selectOptions(screen.getByLabelText('初爻伏神地支'), '亥')
  expect(screen.getByText('人工校正')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '恢复初爻自动值' }))
  expect(screen.queryByText('人工校正')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Verify the professional-editor tests fail**

```powershell
npm test -- tests/integration/manual-flow.test.tsx
```

Expected: failures because the current page exposes `6/7/8/9`, only overrides六神, and has no search or伏神 editor.

- [ ] **Step 3: Implement the accessible search combobox**

Use `role="combobox"`, `role="listbox"`, `role="option"`, `aria-expanded`, `aria-controls`, arrow-key selection, Enter selection and Escape close. Show `找到 N 个卦象` and `没有匹配的卦象`. Clicking outside closes the list without changing the chart.

- [ ] **Step 4: Implement four-pillar editor**

Show cast time plus year/month/day/hour fields. Initial cast time calls `calculateSizhu` locally. Editing any pillar writes `ChartOverrides.sizhu`; editing day immediately rebuilds preview so六神 and旬空 update. Add “使用起卦时间重新计算” to clear the sizhu override.

- [ ] **Step 5: Implement the two-row yao editor**

Render positions `[6, 5, 4, 3, 2, 1]`. First row contains visible labels and 44px minimum touch targets for六神、阴阳、动静、世应. Second row contains六亲、地支 and伏神 disclosure. Use actual爻线 CSS for阴阳, not `6/7/8/9` text.

- [ ] **Step 6: Implement inline validation and first-error focus**

Each editor section owns a stable element id such as `manual-question-error`, `manual-sizhu-error`, `manual-line-3-error`. On submit, focus or scroll to the first issue target with `element.scrollIntoView({ block: 'center' })`. In reduced-motion mode use `behavior: 'auto'`; otherwise use `behavior: 'smooth'`.

- [ ] **Step 7: Remove superseded components and CSS**

Delete `QuickEntry.tsx` and `ProfessionalEditor.tsx` only after all imports are removed. Remove `.quick-entry*` rules. Do not delete shared `.field`, `.btn`, `.review-panel` rules used elsewhere.

- [ ] **Step 8: Run manual and mobile tests**

```powershell
npm test -- tests/integration/manual-flow.test.tsx tests/unit/manual-model.test.ts
npm run test:e2e -- tests/e2e/manual-and-answer.spec.ts tests/e2e/mobile-layout.spec.ts
```

Expected: all pass.

- [ ] **Step 9: Commit Task 4**

```powershell
git add src/features/manual src/styles/global.css tests/integration/manual-flow.test.tsx tests/e2e/manual-and-answer.spec.ts tests/e2e/mobile-layout.spec.ts
git commit -m "feat: redesign professional manual chart editor"
```

---

### Task 5: 页面过渡与全组件互动反馈

**Files:**
- Modify: `src/components/PageFrame.tsx`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/global.css`
- Modify: interactive components under `src/features/**`
- Create: `tests/e2e/navigation-and-manual.spec.ts`
- Modify: `tests/e2e/mobile-layout.spec.ts`

**Interfaces:**
- `PageFrame` sets `data-direction="forward|back"` and a changing keyed child for entry animation.
- Reusable transient status copy is exposed through existing component props; do not create global toast state.

- [ ] **Step 1: Add failing interaction-state E2E assertions**

```ts
test('controls expose focus, pressed and saved feedback', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '手动排盘' }).click()
  await page.getByRole('button', { name: '阳', exact: true }).first().click()
  await expect(page.getByRole('button', { name: '阳', exact: true }).first()).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByText('草稿已保存')).toBeVisible()
})
```

Add CSS-state checks through computed styles only for behavior the app owns: focus outline is non-none, pressed control transform changes while active through a small test helper page, and reduced motion has near-zero transition duration.

- [ ] **Step 2: Verify the feedback test fails**

```powershell
npm run test:e2e -- tests/e2e/mobile-layout.spec.ts
```

Expected: current controls lack consistent pressed/status behavior and page-frame transitions.

- [ ] **Step 3: Add semantic interaction tokens**

Add tokens for focus ring, active transform, transition duration and easing. Keep the current paper, ink and cinnabar palette.

```css
:root {
  --motion-page: 220ms;
  --motion-control: 140ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --focus-ring: 0 0 0 3px rgba(182, 73, 61, 0.2);
}
```

- [ ] **Step 4: Apply one consistent control cycle**

Cover buttons, entry cards, history titles, native selects, inputs, textareas, disclosures and coin controls. Use `:focus-visible`, `:active`, `[aria-pressed='true']`, `[aria-expanded='true']`, `:disabled` and `.is-success/.is-error`. Never animate width, height, top or left.

- [ ] **Step 5: Implement directional page transitions**

Use CSS keyframes on the page frame keyed by navigation entry. Forward and back use opposite `translateX` values no greater than 14px. Reduced-motion sets animation and transitions to 0.01ms and removes transforms.

- [ ] **Step 6: Run visual pre-flight at 320, 375 and 430**

Run:

```powershell
npm run test:e2e -- tests/e2e/mobile-layout.spec.ts tests/e2e/navigation-and-manual.spec.ts
```

Check no horizontal overflow, no wrapped primary CTA, visible focus, readable disabled controls, consistent朱砂 accent and no hidden return button.

- [ ] **Step 7: Commit Task 5**

```powershell
git add src/components/PageFrame.tsx src/styles src/features tests/e2e/mobile-layout.spec.ts tests/e2e/navigation-and-manual.spec.ts
git commit -m "feat: add tactile feedback and page transitions"
```

---

### Task 6: 人类可读排盘与结构化 AI 提示词

**Files:**
- Create: `src/engines/prompt/structured.ts`
- Create: `tests/unit/prompt-structured.test.ts`
- Modify: `src/engines/prompt/formatter.ts`
- Modify: `src/engines/prompt/engine.ts`
- Modify: `src/domain/versions.ts`
- Modify: `src/features/result/FullChart.tsx`
- Modify: `src/features/result/PromptPanel.tsx`
- Modify: `tests/unit/prompt.test.ts`
- Modify: `tests/integration/result-flow.test.tsx`

**Interfaces:**

```ts
export interface StructuredPromptLine {
  position: LinePosition
  type: YinYang
  changing: boolean
  gan: string
  zhi: string
  wuxing: string
  liuqin: string
  liushen: string
  shiYing: 'shi' | 'ying' | null
  xunKong: boolean
  fushen: Fushen | null
  overriddenFields: readonly OverrideField[]
}

export interface StructuredPromptData {
  schemaVersion: number
  engineVersion: string
  promptVersion: string
  question: string
  category: string
  note: string
  castAt: string
  method: string
  sizhu: Sizhu
  yueJian: string
  riChen: string
  xunKong: readonly [string, string]
  original: { name: string; palace: string; palaceElement: string; lines: StructuredPromptLine[] }
  changed: null | { name: string; lines: StructuredPromptLine[] }
  changingLines: readonly LinePosition[]
}

export function buildStructuredPromptData(caseValue: DivinationCase): StructuredPromptData
export function formatReadableChart(caseValue: DivinationCase): string[]
```

- [ ] **Step 1: Write failing consistency tests**

The production breaks caught here are omitting overridden fields, ordering爻 incorrectly, or generating readable text and JSON from different data.

```ts
it('orders readable and structured lines from upper to initial', () => {
  const value = buildCase()
  const structured = buildStructuredPromptData(value)
  expect(structured.original.lines.map((line) => line.position)).toEqual([6, 5, 4, 3, 2, 1])
  expect(formatReadableChart(value)[0]).toContain('上爻')
})

it('professional prompt contains parseable JSON equal to the case snapshot', () => {
  const value = buildCase()
  const content = generatePrompt(value, 'professional').content
  const json = content.split('```json\n')[1].split('\n```')[0]
  expect(JSON.parse(json)).toEqual(buildStructuredPromptData(value))
})

it('concise prompt does not include the structured JSON block', () => {
  expect(generatePrompt(buildCase(), 'concise').content).not.toContain('```json')
})
```

- [ ] **Step 2: Verify prompt tests fail**

```powershell
npm test -- tests/unit/prompt-structured.test.ts tests/unit/prompt.test.ts tests/integration/result-flow.test.tsx
```

Expected: failures because current formatter uses initial-to-upper order and professional prompt has no JSON block.

- [ ] **Step 3: Implement one structured-data builder**

Build data directly from the stored chart. Do not parse formatted text. Sort copied line arrays descending by position without mutating the case. Use `JSON.stringify(data, null, 2)` only at the final formatting boundary.

- [ ] **Step 4: Upgrade readable chart formatting**

Use Chinese positions `上爻、五爻、四爻、三爻、二爻、初爻` and include六神、阴阳、动静、干支、五行、六亲、世应、旬空、伏神与人工校正. Avoid emoji and Unicode卦线 characters that may render inconsistently; use the existing words“阳”“阴”.

- [ ] **Step 5: Upgrade professional prompt and version**

Set `PROMPT_VERSION` to `2.0.0`. Professional content order is task instructions, readable chart, fenced JSON, numbered constraints and final self-check. Concise content retains its current compact form.

- [ ] **Step 6: Mark corrections in result chart**

`FullChart` shows “人工校正” only when `overriddenFields.length > 0` and lists the corrected field labels. It must not imply that the whole chart was manually fabricated.

- [ ] **Step 7: Run prompt and result tests**

```powershell
npm test -- tests/unit/prompt-structured.test.ts tests/unit/prompt.test.ts tests/integration/result-flow.test.tsx
```

Expected: all pass.

- [ ] **Step 8: Commit Task 6**

```powershell
git add src/engines/prompt src/domain/versions.ts src/features/result/FullChart.tsx src/features/result/PromptPanel.tsx tests/unit/prompt-structured.test.ts tests/unit/prompt.test.ts tests/integration/result-flow.test.tsx
git commit -m "feat: add structured professional prompts"
```

---

### Task 7: 端到端主流程与回归收口

**Files:**
- Modify: `tests/e2e/navigation-and-manual.spec.ts`
- Modify: `tests/e2e/manual-and-answer.spec.ts`
- Modify: `tests/e2e/mobile-layout.spec.ts`
- Modify: `tests/e2e/offline.spec.ts`
- Modify: `docs/xhs-review-guide.md`

**Interfaces:**
- No new production interfaces. This task proves the contracts from Tasks 1-6 together.

- [ ] **Step 1: Add the complete failing E2E scenario before final integration fixes**

```ts
test('searches, auto-fills, corrects, returns and generates structured prompt', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '手动排盘' }).click()
  await page.getByLabel('你的问题').fill('这次合作是否适合推进？')
  await page.getByLabel('问题类别').selectOption('career')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('combobox', { name: '搜索卦名' }).fill('泰')
  await page.getByRole('option', { name: '地天泰' }).click()
  await expect(page.getByText('本卦：地天泰')).toBeVisible()
  await page.getByRole('button', { name: '上爻动' }).click()
  await expect(page.getByText(/变卦：/)).toBeVisible()
  await page.getByRole('button', { name: '生成正式结果' }).click()
  await page.getByRole('button', { name: '生成专业版提示词' }).click()
  const prompt = page.getByLabel('提示词内容')
  await expect(prompt).toContainText('```json')
  await expect(prompt).toContainText('"original"')
  await page.getByRole('button', { name: '返回' }).click()
  await expect(page.getByRole('combobox', { name: '搜索卦名' })).toHaveValue('地天泰')
})
```

- [ ] **Step 2: Add browser-back, history-state and offline assertions**

Cover:

```ts
await page.goBack()
await expect(page.getByRole('heading', { name: '卦例记录' })).toBeVisible()
await expect(page.getByLabel('搜索卦例')).toHaveValue('考试')
```

Abort all `http:` and `https:` requests except localhost in `offline.spec.ts`, reload, and complete one manual chart from stored assets.

- [ ] **Step 3: Run all automated verification**

```powershell
npm run lint
npm test
npm run build
npm run test:e2e
```

Expected:

- ESLint exit 0.
- All Vitest files pass.
- Build emits classic IIFE and `verify:xhs` reports `0 violations`.
- All Playwright tests pass at configured mobile widths.

- [ ] **Step 4: Run the design pre-flight audit**

Check the actual rendered pages in the local browser:

- Every non-home page has a visible return button.
- Forward and back transitions have correct direction and no flash.
- Reduced-motion mode removes travel.
- Search, selects, toggles, disclosures, buttons and save actions show feedback.
- No visible `6/7/8/9` input remains in manual mode.
- All six lines show六神、阴阳、动静、六亲、地支、世应和伏神 access.
- No em dash appears in visible product copy.
- Only the existing朱砂 accent is used.
- 320px, 375px and 430px have no horizontal scroll.
- Dark mode is not introduced in this release because the approved brand is a fixed paper interface; verify readable contrast in the fixed theme.

- [ ] **Step 5: Update review documentation**

Add manual checks to `docs/xhs-review-guide.md` for container back behavior, search and auto-fill, field correction recovery, structured prompt JSON, keyboard focus, reduced motion and device widths.

- [ ] **Step 6: Commit Task 7**

```powershell
git add tests/e2e docs/xhs-review-guide.md
git commit -m "test: cover navigation and professional manual flow"
```

---

### Task 8: 小红书发布包重新生成与验证

**Files:**
- Generated, ignored: `dist/**`
- Generated, ignored: `release/wenyao-xhs-0.1.0.zip`
- Generated, ignored: `release/release-summary.md`
- Existing icon: `release/wenyao-icon-512.png`

**Interfaces:**
- Uses existing `scripts/prepare-xhs-build.mjs`, `scripts/verify-xhs-build.mjs` and `scripts/package-xhs.ps1` without weakening any rule.

- [ ] **Step 1: Confirm a clean tracked worktree**

```powershell
git status --short
```

Expected: no tracked modifications after Task 7 commits.

- [ ] **Step 2: Build and package**

```powershell
npm run build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/package-xhs.ps1 -IconPath release/wenyao-icon-512.png
```

Expected: build scan `0 violations`, ZIP below 2MB recommendation, root `index.html`, valid 512x512 PNG.

- [ ] **Step 3: Inspect raw ZIP entry names**

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead('release/wenyao-xhs-0.1.0.zip')
try { $archive.Entries | ForEach-Object FullName } finally { $archive.Dispose() }
```

Expected: entries use `/`, no entry contains `\`, no wrapper directory, and `index.html` is at ZIP root.

- [ ] **Step 4: Record final evidence**

```powershell
Get-Item release/wenyao-xhs-0.1.0.zip,release/wenyao-icon-512.png | Select-Object FullName,Length
Get-FileHash release/wenyao-xhs-0.1.0.zip,release/wenyao-icon-512.png -Algorithm SHA256 | Select-Object Path,Hash
```

Report the new ZIP path, byte size, SHA-256, test totals and remaining external PC simulator/device checks. Do not claim simulator or device success until those checks are performed in Xiaohongshu tooling.

---

## Plan Self-Review

- Spec coverage: navigation stack, return behavior, manual auto-fill, professional overrides,伏神、世应、四柱、六神、interaction feedback, structured prompt, mobile widths, offline and packaging are each assigned to a task.
- Placeholder scan: every task contains exact files, interfaces, test commands, expected results and commit commands.
- Type consistency: `ManualEditorState`, `ManualDraftSnapshot`, `ChartOverrides`, `NavigationEntry` and `StructuredPromptData` have one declared owner and are consumed by later tasks with the same names.
- Scope check: this plan does not copy the source project's knowledge base, chat session sidebar, online Agent or backend API.
- Risk check: coin-casting keeps `useCaseSession`; manual editing moves to its own controller, avoiding regressions in the existing cast flow.
