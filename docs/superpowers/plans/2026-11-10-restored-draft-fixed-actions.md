# Restored Draft Fixed Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现场摇卦和手动排盘中明确提示已恢复的未完成草稿，并提供始终可见的“开始新一卦”与阶段主操作，同时强化正式手动排盘页的卦名搜索入口。

**Architecture:** 新增两个共享展示组件：`DraftRecoveryNotice` 负责恢复提示，`PageActionBar` 负责居中、适配安全区的固定底栏。两个业务 hook 显式暴露 `wasRestored` 和 `discardDraft()`；页面只负责确认弹窗与按钮编排。现场摇卦把铜钱面状态上移到 `CastPage`，使“摇动铜钱／确认本轮／生成结果”能够成为页面级固定主操作，而不是复制原按钮。

**Tech Stack:** React 19、TypeScript 6、CSS、Vitest、Testing Library、Playwright、Vite

## Global Constraints

- 本次只改“现场摇卦”和“手动排盘”；结果页、卦例记录页等其他长页面不顺带重构。
- 采用已确认的 A 方案：顶部提示随内容滚动，底部双按钮操作栏固定在视口底部。
- 不改变手动排盘现有面板顺序、字段结构和校正流程；只强化现有卦名搜索控件。
- 恢复提示固定使用：`已恢复上次未完成的卦，可以选择继续完成，也可以开始新一卦。`
- 清空按钮固定使用：`开始新一卦`。
- 确认框标题固定使用：`开始新一卦？`；正文固定使用：`当前未完成的内容会被清空，且无法恢复。`；确认按钮使用：`清空并重新开始`；取消按钮使用：`继续当前卦`。
- 清空必须同时删除对应 localStorage 草稿、创建新的 case ID、重置页面状态；现场摇卦与手动排盘的草稿互不影响。
- 原位置的“生成结果／生成正式结果”必须删除，只保留固定底栏中的唯一实例；不得出现重复主按钮。
- 现场摇卦进行中底栏不能只剩“开始新一卦”：右侧必须按阶段显示“摇动铜钱”“确认本轮”或“生成结果”。
- 全新空白问题页不显示“开始新一卦”；只有存在本轮有效内容时才显示。
- 手动排盘的“保存草稿”“恢复全部自动值”和现场摇卦的“撤销上一爻”“修改卦象”仍留在原内容位置。
- 固定栏必须适配 `--safe-bottom`，不得遮挡最后一项内容，不得产生横向滚动，确认对话框必须显示在固定栏之上。
- 不新增第三方依赖，不改变数据 schema、引擎版本、promptVersion 或正式卦例计算逻辑。
- `prototypes/sticky-action-bar/index.html` 仅为设计参考，不得导入生产代码或进入正式构建入口。
- 当前工作区有用户未提交修改；禁止 `git reset --hard`、`git checkout --` 或覆盖无关改动。每次提交只能暂存本任务文件。
- 本计划不打包小红书发布包；只完成代码、测试和文档门禁。

---

## File Map

**Create**

- `src/components/PageActionBar.tsx`：共享固定底部操作栏及防遮挡占位。
- `src/components/DraftRecoveryNotice.tsx`：共享恢复草稿提示。
- `tests/integration/shared-page-actions.test.tsx`：共享组件结构与可访问性测试。

**Modify**

- `src/components/index.tsx`：导出两个共享组件和类型。
- `src/styles/global.css`：固定栏、恢复提示和卦名搜索强调样式。
- `src/app/use-case-session.ts`：现场摇卦初始恢复元数据及清空 API。
- `src/features/cast/CoinStage.tsx`：改为只展示受控的模拟铜钱面。
- `src/features/cast/PhysicalCoinStage.tsx`：改为只展示、切换受控的现实铜钱面。
- `src/features/cast/CastPage.tsx`：编排恢复提示、确认框和阶段固定操作。
- `src/features/manual/use-manual-editor.ts`：暴露恢复来源并完善现有清空 API。
- `src/features/manual/ManualPage.tsx`：接入提示、固定栏和确认框，移除原主按钮。
- `src/features/manual/HexagramSearch.tsx`：强化可见文案及 placeholder，不改搜索逻辑。
- `tests/unit/use-case-session.test.tsx`：现场摇卦恢复和清空状态机测试。
- `tests/integration/cast-flow.test.tsx`：现场摇卦恢复、继续、清空和唯一主按钮回归。
- `tests/integration/manual-flow.test.tsx`：手动草稿恢复、清空、搜索强调和唯一主按钮回归。
- `tests/integration/navigation-flow.test.tsx`：应用内返回与新一卦生命周期回归。
- `tests/e2e/mobile-layout.spec.ts`：固定定位、滚动后可见、安全区和无溢出验证。
- `docs/architecture.md`：记录恢复草稿与固定操作栏职责边界。
- `docs/implementation-status.md`：记录本次实施结果和门禁数字。
- `docs/xhs-review-guide.md`：加入两种流程的真机检查项。

---

### Task 1: Add Shared Recovery Notice and Fixed Action Bar

**Files:**
- Create: `src/components/PageActionBar.tsx`
- Create: `src/components/DraftRecoveryNotice.tsx`
- Create: `tests/integration/shared-page-actions.test.tsx`
- Modify: `src/components/index.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Produces: `PageActionBar({ secondary, primary, hint? }: PageActionBarProps)`
- Produces: `DraftRecoveryNotice(): JSX.Element`
- CSS contract: `.page-action-bar`, `.page-action-bar__spacer`, `.draft-recovery-notice`

- [ ] **Step 1: Write failing shared-component tests**

Create `tests/integration/shared-page-actions.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DraftRecoveryNotice, PageActionBar } from '../../src/components'

describe('共享页面操作组件', () => {
  it('恢复提示使用确认过的完整文案', () => {
    render(<DraftRecoveryNotice />)
    expect(screen.getByRole('status')).toHaveTextContent(
      '已恢复上次未完成的卦，可以选择继续完成，也可以开始新一卦。',
    )
  })

  it('固定栏只承载一个次操作和一个主操作', () => {
    render(
      <PageActionBar
        secondary={<button type="button">开始新一卦</button>}
        primary={<button type="button">生成结果</button>}
        hint="当前内容已自动保存"
      />,
    )
    const region = screen.getByRole('region', { name: '页面操作' })
    expect(region).toContainElement(screen.getByRole('button', { name: '开始新一卦' }))
    expect(region).toContainElement(screen.getByRole('button', { name: '生成结果' }))
    expect(region).toHaveTextContent('当前内容已自动保存')
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx vitest run tests/integration/shared-page-actions.test.tsx
```

Expected: FAIL because the two components are not exported.

- [ ] **Step 3: Implement the two focused components**

Create `src/components/PageActionBar.tsx`:

```tsx
import type { ReactNode } from 'react'

export interface PageActionBarProps {
  secondary?: ReactNode
  primary: ReactNode
  hint?: string
}

export function PageActionBar({ secondary, primary, hint }: PageActionBarProps) {
  return (
    <>
      <div className="page-action-bar__spacer" aria-hidden="true" />
      <aside className="page-action-bar" role="region" aria-label="页面操作" data-single={!secondary || undefined}>
        <div className="page-action-bar__row">
          {secondary}
          {primary}
        </div>
        {hint ? <p className="page-action-bar__hint">{hint}</p> : null}
      </aside>
    </>
  )
}
```

Create `src/components/DraftRecoveryNotice.tsx`:

```tsx
export function DraftRecoveryNotice() {
  return (
    <aside className="draft-recovery-notice" role="status">
      <span className="draft-recovery-notice__icon" aria-hidden="true">↺</span>
      <p>已恢复上次未完成的卦，可以选择继续完成，也可以开始新一卦。</p>
    </aside>
  )
}
```

Export both components and their prop types from `src/components/index.tsx`.

- [ ] **Step 4: Add fixed-bar and recovery-notice CSS**

Append a dedicated section to `src/styles/global.css`. Keep the existing 460px page width and existing color tokens:

```css
.draft-recovery-notice {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--cinnabar) 28%, transparent);
  border-radius: 16px;
  background: rgb(var(--surface-rgb) / 0.78);
}

.draft-recovery-notice__icon {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--cinnabar) 12%, transparent);
  color: var(--cinnabar-dark);
  font-weight: 800;
}

.draft-recovery-notice p { margin: 0; line-height: 1.65; }

.page-action-bar__spacer { height: calc(96px + var(--safe-bottom)); }

.page-action-bar {
  position: fixed;
  z-index: 800;
  left: 50%;
  bottom: 0;
  width: min(100%, 460px);
  transform: translateX(-50%);
  padding: 12px max(16px, var(--safe-right)) calc(12px + var(--safe-bottom)) max(16px, var(--safe-left));
  border-top: 1px solid var(--line);
  background: rgb(var(--surface-rgb) / 0.9);
  box-shadow: 0 -14px 34px rgba(60, 43, 28, 0.12);
  backdrop-filter: blur(18px) saturate(1.2);
}

.page-action-bar__row {
  display: grid;
  grid-template-columns: minmax(118px, 0.78fr) minmax(0, 1.3fr);
  gap: 10px;
}

.page-action-bar[data-single='true'] .page-action-bar__row { grid-template-columns: 1fr; }
.page-action-bar__row > .btn { width: 100%; min-width: 0; min-height: 52px; }
.page-action-bar__hint { margin: 7px 2px 0; color: var(--ink-muted); font-size: 0.72rem; text-align: center; }
```

Do not raise the bar above `.confirm-dialog` (`z-index: 1000`). Add a desktop media rule only if the existing desktop layout visibly needs an 18px floating offset; mobile behavior is the source of truth.

- [ ] **Step 5: Run tests and lint the new files**

Run:

```powershell
npx vitest run tests/integration/shared-page-actions.test.tsx
npx eslint src/components/PageActionBar.tsx src/components/DraftRecoveryNotice.tsx tests/integration/shared-page-actions.test.tsx
```

Expected: PASS, 0 lint errors.

- [ ] **Step 6: Commit the shared UI unit**

```powershell
git add src/components/PageActionBar.tsx src/components/DraftRecoveryNotice.tsx src/components/index.tsx src/styles/global.css tests/integration/shared-page-actions.test.tsx
git commit -m "feat: add fixed page action bar"
```

---

### Task 2: Make Live-Cast Recovery and Discard Explicit

**Files:**
- Create: `tests/unit/use-case-session.test.tsx`
- Modify: `src/app/use-case-session.ts`

**Interfaces:**
- Produces on `CaseSession`: `wasRestored: boolean`
- Produces on `CaseSession`: `discardDraft(): void`
- `discardDraft()` clears `draftStore`, resets to `freshState()`, assigns a new case ID, and sets `wasRestored` to `false`.

- [ ] **Step 1: Write failing hook tests for restore and discard**

Create `tests/unit/use-case-session.test.tsx` using `renderHook` and `act`. Seed a valid draft through the real `draftStore`; assert:

```tsx
expect(result.current.wasRestored).toBe(true)
expect(result.current.question).toBe('恢复中的问题')

act(() => result.current.discardDraft())

expect(result.current.wasRestored).toBe(false)
expect(result.current.step).toBe('question')
expect(result.current.question).toBe('')
expect(result.current.rawValues).toEqual([])
expect(draftStore.load()).toBeNull()
```

Seed the draft with the real factory and store so the test exercises the same validated payload as production:

```tsx
const draft = createDraft({
  question: '恢复中的问题',
  category: 'career',
  castAt: '2026-11-10T07:00:00.000Z',
  method: 'simulated-coins',
})
draftStore.save({
  ...draft,
  rawValues: [9, 9],
  coinThrows: [
    { round: 1, faces: [1, 1, 1], rawValue: 9 },
    { round: 2, faces: [1, 1, 1], rawValue: 9 },
  ],
})
```

- [ ] **Step 2: Run the hook tests and verify RED**

```powershell
npx vitest run tests/unit/use-case-session.test.tsx
```

Expected: FAIL because `wasRestored` and `discardDraft` do not exist.

- [ ] **Step 3: Return restore metadata instead of only state**

Replace `restoreState()` with a loader shaped as:

```ts
interface InitialSession {
  state: SessionState
  wasRestored: boolean
}

function loadInitialSession(): InitialSession {
  const draft = draftStore.load()
  if (!draft || (draft.rawValues.length === 0 && !draft.question)) {
    return { state: freshState(), wasRestored: false }
  }
  const step: SessionStep = draft.rawValues.length === 6 ? 'review' : 'casting'
  return {
    state: {
      ...freshState(),
      caseId: draft.id,
      method: draft.method,
      question: draft.question,
      category: draft.category,
      note: draft.note,
      castAt: draft.castAt,
      castStartedAt: draft.castStartedAt ?? null,
      coinThrows: draft.coinThrows,
      entries: rawValuesToEntries(draft.rawValues),
      step,
    },
    wasRestored: true,
  }
}
```

Initialize the hook from one stable `useRef(loadInitialSession()).current`, then maintain `wasRestored` in state so discard can update the UI without remounting.

- [ ] **Step 4: Add `discardDraft()` to `CaseSession`**

Implement:

```ts
const discardDraft = useCallback(() => {
  draftStore.clear()
  setWasRestored(false)
  setState(freshState())
}, [])
```

Expose it and `wasRestored` from the returned controller. Do not reuse `completeCast()`: completion returns a formal case, while discard must not create one.

- [ ] **Step 5: Run focused and existing draft-store tests**

```powershell
npx vitest run tests/unit/use-case-session.test.tsx tests/unit/draft-store.test.ts tests/integration/cast-flow.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the live-session state unit**

```powershell
git add src/app/use-case-session.ts tests/unit/use-case-session.test.tsx
git commit -m "feat: expose live cast draft recovery state"
```

---

### Task 3: Move Live-Cast Primary Actions into the Fixed Bar

**Files:**
- Modify: `src/features/cast/CoinStage.tsx`
- Modify: `src/features/cast/PhysicalCoinStage.tsx`
- Modify: `src/features/cast/CastPage.tsx`
- Modify: `tests/integration/cast-flow.test.tsx`

**Interfaces:**
- `CoinStage({ faces }: { faces: CoinFaces })` displays only; it does not render a submit button.
- `PhysicalCoinStage({ faces, onFlip }: { faces: CoinFaces; onFlip(index: 0 | 1 | 2): void })` displays and flips only; it does not confirm the round.
- `CastPage` owns the current unconfirmed `simulatedFaces` and `physicalFaces`.

- [ ] **Step 1: Add failing integration coverage for restored UI and unique fixed actions**

Extend `tests/integration/cast-flow.test.tsx`:

1. In `摇到一半退出后草稿可以恢复`, after remount assert the exact recovery sentence and both actions.
2. Assert there is exactly one accessible `摇动铜钱` button during simulated casting.
3. After six rounds assert there is exactly one `生成结果` button.
4. Add `清空恢复中的现场摇卦后回到全新问题页`:

```tsx
await user.click(screen.getByRole('button', { name: '开始新一卦' }))
expect(screen.getByRole('dialog', { name: '开始新一卦？' })).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: '继续当前卦' }))
expect(screen.getByText('第 3 爻 / 共六爻')).toBeInTheDocument()

await user.click(screen.getByRole('button', { name: '开始新一卦' }))
await user.click(screen.getByRole('button', { name: '清空并重新开始' }))
expect(screen.getByLabelText('你的问题')).toHaveValue('')
expect(screen.queryByRole('button', { name: '开始新一卦' })).not.toBeInTheDocument()
expect(draftStore.load()).toBeNull()
```

- [ ] **Step 2: Run the cast-flow test and verify RED**

```powershell
npx vitest run tests/integration/cast-flow.test.tsx
```

Expected: FAIL because the notice, fixed bar and clear dialog are absent.

- [ ] **Step 3: Make both coin stages controlled display components**

Move `throwCoins()` and both face states into `CastPage`. Remove the internal primary buttons from `CoinStage` and `PhysicalCoinStage`. Preserve the existing three coin labels and physical coin toggle accessibility.

In `CastPage`, add:

```tsx
const [simulatedFaces, setSimulatedFaces] = useState<CoinFaces>([0, 0, 0])
const [physicalFaces, setPhysicalFaces] = useState<CoinFaces>([0, 0, 0])

const throwSimulatedRound = () => {
  const next = throwCoins()
  setSimulatedFaces(next)
  session.addCoinRound(next)
}

const confirmPhysicalRound = () => {
  session.addCoinRound(physicalFaces)
  setPhysicalFaces([0, 0, 0])
}
```

Use immutable tuple replacement when flipping a physical coin.

- [ ] **Step 4: Render the recovery notice and confirmation dialog**

Add `newCastOpen` local state. Render `DraftRecoveryNotice` immediately after the page begins when `session.wasRestored` is true. The confirm handler must call `session.discardDraft()`, reset both local face tuples to `[0, 0, 0]`, then close the dialog.

- [ ] **Step 5: Render exactly one contextual fixed primary action**

For `casting`:

```tsx
<PageActionBar
  secondary={<button className="btn" onClick={() => setNewCastOpen(true)}>开始新一卦</button>}
  primary={session.method === 'physical-coins' ? (
    <button className="btn btn--primary" aria-label="确认本轮" onClick={confirmPhysicalRound}>
      确认本轮 · 第 {session.rawValues.length + 1} 轮
    </button>
  ) : (
    <button className="btn btn--primary" aria-label="摇动铜钱" onClick={throwSimulatedRound}>
      摇动铜钱 · 第 {session.rawValues.length + 1} 轮
    </button>
  )}
  hint="当前内容已自动保存"
/>
```

For `review`, render `开始新一卦 | 生成结果` in the same component. Remove the old `生成结果` from `.review-panel`. Keep `修改卦象` inline.

Fresh `question` and `method` states do not need a fixed bar. This task does not change how a question-only draft is represented in the existing `DivinationCase` draft schema.

- [ ] **Step 6: Run the focused integration tests**

```powershell
npx vitest run tests/integration/cast-flow.test.tsx tests/integration/navigation-flow.test.tsx
```

Expected: PASS; the existing accessible names `摇动铜钱`, `确认本轮`, and `生成结果` continue to work.

- [ ] **Step 7: Commit the live-page UI unit**

```powershell
git add src/features/cast/CoinStage.tsx src/features/cast/PhysicalCoinStage.tsx src/features/cast/CastPage.tsx tests/integration/cast-flow.test.tsx
git commit -m "feat: add fixed actions to live casting"
```

---

### Task 4: Add Manual Recovery Actions and Emphasize Hexagram Search

**Files:**
- Modify: `src/features/manual/use-manual-editor.ts`
- Modify: `src/features/manual/ManualPage.tsx`
- Modify: `src/features/manual/HexagramSearch.tsx`
- Modify: `src/styles/global.css`
- Modify: `tests/integration/manual-flow.test.tsx`
- Modify: `tests/integration/navigation-flow.test.tsx`

**Interfaces:**
- Produces on `ManualEditorController`: `wasRestored: boolean`
- Existing `discardDraft()` remains the only manual reset implementation and now also sets `wasRestored` false.

- [ ] **Step 1: Add failing manual recovery and reset tests**

Extend `tests/integration/manual-flow.test.tsx` with a helper that creates an unfinished manual entry, unmounts, and remounts. Assert:

```tsx
expect(screen.getByRole('status')).toHaveTextContent('已恢复上次未完成的卦')
expect(screen.getByRole('button', { name: '开始新一卦' })).toBeInTheDocument()
expect(screen.getAllByRole('button', { name: '生成正式结果' })).toHaveLength(1)
```

Then verify cancel preserves the current question and confirm clears the manual store and returns to the empty question step.

Add search assertions:

```tsx
const search = screen.getByRole('combobox', { name: '搜索卦名' })
expect(search).toHaveAttribute('placeholder', '输入卦名，如：乾、风山渐')
expect(screen.getByText('搜索并选择卦名')).toBeInTheDocument()
```

- [ ] **Step 2: Run manual and navigation tests and verify RED**

```powershell
npx vitest run tests/integration/manual-flow.test.tsx tests/integration/navigation-flow.test.tsx
```

Expected: FAIL because restoration is not exposed in UI and the old label/placeholder remain.

- [ ] **Step 3: Expose unfinished-manual restoration explicitly**

Add `wasRestored` to the object returned by `loadedState()` and to `ManualEditorController`.

Rules:

```ts
const wasRestored = Boolean(snapshot && !snapshot.completed)
```

- A completed snapshot restored only because navigation direction is `back` is for post-result correction; it must not show the “上次未完成” notice.
- An unfinished snapshot restored from home must set `wasRestored: true`.
- `discardDraft()` must call `setWasRestored(false)` in addition to its existing clear/new-ID/fresh-state work.

- [ ] **Step 4: Move the manual primary action into the fixed bar**

In `ManualPage`:

- Add `newCastOpen` state and the exact shared confirmation dialog copy.
- Render `DraftRecoveryNotice` only for `controller.wasRestored`.
- Keep `保存草稿` in its existing content location.
- Remove the old inline `生成正式结果` button.
- Add `PageActionBar` at the end of the non-empty manual page with `开始新一卦 | 生成正式结果`.
- Use the existing `complete()` function; do not duplicate case construction.
- Disable the fixed primary button when `controller.issues.length > 0 || !controller.chart`. The existing `ManualValidationSummary` remains visible and owns navigation to the first issue.
- Confirming reset calls `controller.discardDraft()` and closes the dialog.

- [ ] **Step 5: Emphasize only the existing search control**

In `HexagramSearch.tsx`, keep `aria-label="搜索卦名"` stable, change the visible label and add the placeholder with this exact diff:

```diff
- <span className="field__label">卦名搜索</span>
+ <span className="field__label hexagram-search__label">搜索并选择卦名</span>
  <input
    role="combobox"
    aria-label="搜索卦名"
+   placeholder="输入卦名，如：乾、风山渐"
    aria-expanded={open}
    aria-controls={listboxId}
    aria-autocomplete="list"
    value={query}
```

In `global.css`, do not add a new card or alter panel order. Emphasize label and input only:

```css
.hexagram-search__label {
  color: var(--cinnabar-dark);
  font-size: 1rem;
  font-weight: 700;
}

.hexagram-search input[role='combobox'] {
  min-height: 52px;
  border-width: 2px;
  border-color: color-mix(in srgb, var(--cinnabar) 55%, var(--line-strong));
  background: color-mix(in srgb, var(--cinnabar) 5%, var(--input-bg));
}

.hexagram-search input[role='combobox']:focus {
  border-color: var(--cinnabar);
  box-shadow: var(--focus-ring);
}
```

- [ ] **Step 6: Preserve completed-draft navigation semantics**

Extend `tests/integration/navigation-flow.test.tsx`:

- Returning from result to manual still restores the completed chart for correction.
- That return path does not render the “上次未完成” notice.
- Entering manual from home after a completed result remains fresh.
- Confirming “开始新一卦” from an unfinished restored manual draft clears only `manualDraftStore`.

- [ ] **Step 7: Run the manual-focused test set**

```powershell
npx vitest run tests/integration/manual-flow.test.tsx tests/integration/navigation-flow.test.tsx tests/unit/manual-draft-store.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the manual-page unit**

```powershell
git add src/features/manual/use-manual-editor.ts src/features/manual/ManualPage.tsx src/features/manual/HexagramSearch.tsx src/styles/global.css tests/integration/manual-flow.test.tsx tests/integration/navigation-flow.test.tsx
git commit -m "feat: add fixed actions to manual casting"
```

---

### Task 5: Verify Mobile Fixed Positioning and Safe Areas

**Files:**
- Modify: `tests/e2e/mobile-layout.spec.ts`

**Interfaces:**
- Consumes: `.page-action-bar`, `--safe-bottom`, visible button labels.
- Produces: browser-level proof that the bar remains fixed while the document scrolls.

- [ ] **Step 1: Add the failing Playwright scenario**

Add a test at 320×568 and 375×667 that enters manual mode, completes the question step, selects `地天泰`, and captures the action bar geometry before and after scrolling:

```ts
const actionBar = page.locator('.page-action-bar')
await expect(actionBar).toBeVisible()
await expect(page.getByRole('button', { name: '生成正式结果' })).toBeVisible()

const before = await actionBar.boundingBox()
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
const after = await actionBar.boundingBox()

expect(before?.y).toBe(after?.y)
expect(await actionBar.evaluate((element) => getComputedStyle(element).position)).toBe('fixed')
```

Also assert:

- `document.documentElement.scrollWidth <= viewport.width`.
- The last inline control can be scrolled above the top edge of the fixed bar (spacer works).
- Only one `生成正式结果` is present.

- [ ] **Step 2: Add safe-bottom verification**

Inject `--safe-area-inset-bottom: 11px` before entering the page and assert the computed bottom padding is at least 23px (12px base + 11px safe area). Do not hard-code a device-specific pixel height for the entire bar.

- [ ] **Step 3: Run build, then the focused E2E test**

```powershell
npm run build
npx playwright test tests/e2e/mobile-layout.spec.ts
```

Expected: build exit 0; all mobile-layout projects PASS.

- [ ] **Step 4: Commit the responsive regression unit**

```powershell
git add tests/e2e/mobile-layout.spec.ts
git commit -m "test: cover fixed casting actions on mobile"
```

---

### Task 6: Update Documentation and Run Release Gates

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/implementation-status.md`
- Modify: `docs/xhs-review-guide.md`

**Interfaces:**
- Documentation must describe actual verified behavior, not planned behavior.

- [ ] **Step 1: Update architecture after code is stable**

Add a concise section describing:

- `PageActionBar` is a page-level fixed action container, not business logic.
- Live and manual hooks own draft clearing and restoration metadata.
- Restored notices appear only for unfinished stored drafts.
- Completed manual drafts restored by back-navigation are correction sessions, not “unfinished draft” notifications.
- The action-bar spacer and safe-area padding prevent content occlusion.

- [ ] **Step 2: Update the implementation status**

Add a dated `2026-11-10` subsection with a table covering:

1. Live draft restore notice and new-cast reset.
2. Manual draft restore notice and new-cast reset.
3. Contextual fixed action bar and removal of duplicate primary buttons.
4. Emphasized hexagram search.
5. Exact final unit/integration/E2E test counts from the commands below.

Do not invent counts before running the full gates. State explicitly that no XHS package was produced.

- [ ] **Step 3: Extend the real-device checklist**

Add checks to `docs/xhs-review-guide.md`:

- Restore a half-finished simulated cast; scroll; verify both bottom actions remain visible.
- Restore a half-finished physical coin entry; verify `确认本轮` remains available.
- Cancel and confirm `开始新一卦`; verify cancel preserves and confirm clears.
- Restore an unfinished manual draft; verify notice, emphasized search, fixed actions and no duplicate generate button.
- Open the virtual keyboard near the bottom; verify fields can still scroll above the fixed bar and no control is permanently covered.

- [ ] **Step 4: Run the complete fresh verification suite**

```powershell
npm run lint
npm test
npm run build
npm run test:e2e
```

Expected: every command exits 0. Read and record the exact test totals. `npm run build` also runs the existing XHS output verifier, but this task must not zip or publish anything.

- [ ] **Step 5: Inspect the final diff and scope**

```powershell
git status --short
git diff --check
git diff --stat
```

Confirm:

- No unrelated user files were reverted.
- No duplicate primary button remains in `CastPage` or `ManualPage`.
- Prototype code is not imported anywhere under `src/`.
- No version field changed.
- No package or ZIP artifact was generated.

- [ ] **Step 6: Commit documentation only**

```powershell
git add docs/architecture.md docs/implementation-status.md docs/xhs-review-guide.md
git commit -m "docs: record restored draft action flow"
```

---

## Self-Review Checklist

- [x] Both requested flows have a visible recovery notice and recoverable cancel path.
- [x] Both requested flows have an explicit destructive reset with exact approved copy.
- [x] Live casting always preserves a contextual continue action during actual casting.
- [x] Original inline generate buttons are removed rather than duplicated.
- [x] Manual panel order remains unchanged; only the search label/input styling changes.
- [x] Fresh empty entry does not show a meaningless new-cast action.
- [x] Completed manual back-navigation semantics are preserved.
- [x] Fixed positioning, safe areas, content occlusion and narrow widths have browser-level coverage.
- [x] Result/history pages, prompt logic, data schemas, versions and packaging are explicitly out of scope.
- [x] No placeholder steps (`TBD`, `TODO`, “similar to”) remain.

