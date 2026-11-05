# 问卦人物关系类别扩展实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有问题类别中新增“子女／晚辈”“父母／长辈”“兄弟姐妹／同辈”，分别路由到子孙、父母、兄弟主用神候选，同时保持复合问题的谨慎表述、旧数据兼容和提示词可追溯。

**Architecture:** 继续使用 `QuestionCategory → YONGSHEN_BY_CATEGORY → interpret/generatePrompt` 的单一路径，不增加第二个事项选择器，也不做文本推断。领域层扩展稳定枚举并迁移 schema；UI 只消费统一选项表；解释层提供候选用神和说明；提示词明确“主用神候选”；存储与备份沿现有迁移链往返。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest、Testing Library、Playwright、IndexedDB/localStorage。

## Global Constraints

- 三个稳定枚举值固定为 `children`、`parents`、`siblings`。
- 展示文案固定为“子女／晚辈”“父母／长辈”“兄弟姐妹／同辈”。
- 关系均以问卦人为参照；关系不明确、朋友、同事、陌生人继续选择“其他”。
- 三类主用神候选依次为子孙、父母、兄弟；不得自动推断辅助六亲。
- 提示词字段使用“主用神候选”，不得写成无需确认的最终“用神”。
- 不重算旧卦例，不改旧类别，不改既有排盘或提示词快照。
- `SCHEMA_VERSION` 2 → 3；`ENGINE_VERSION` 0.2.0 → 0.2.1；`PROMPT_VERSION` 2.1.1 → 2.2.0。
- 不新增运行时依赖，不增加网络、文件、剪贴板或容器权限。
- 当前工作区已有大量用户未提交改动。每个任务编辑前先执行 `git diff -- <files>`，只做局部补丁；提交时用 `git add -p -- <modified-files>` 只暂存本任务 hunk，新文件才使用 `git add -- <new-file>`。每次提交前运行 `git diff --cached` 逐项确认，禁止 `git add -A` 或覆盖、误提交用户改动。
- `package.json` 当前未提交版本为 0.3.4，本计划不修改应用包版本；发布版本另按现有发布序列决定。

---

## File Map

- `src/domain/types.ts`：扩展 `QuestionCategory` 类型。
- `src/domain/validation.ts`：接受三个新枚举值。
- `src/domain/versions.ts`：记录 schema、engine、prompt 语义版本。
- `src/storage/migrations.ts`：增加 v2 → v3 的无损迁移。
- `src/features/shared/categories.ts`：维护 UI 类别顺序和标签。
- `src/features/cast/QuestionStep.tsx`：展示类别说明。
- `src/features/manual/ManualPage.tsx`：复用统一选项表，删除重复硬编码选项。
- `src/engines/interpretation/categories.ts`：新增三类候选用神和复合事项说明。
- `src/engines/interpretation/disclaimers.ts`：为人物关系类提供复合风险提示。
- `src/engines/prompt/templates.ts`：新增三个类别标签。
- `src/engines/prompt/engine.ts`：把“用神”收紧为“主用神候选”。
- `tests/`：领域、迁移、UI、初判、提示词、存储和 E2E 回归。
- `docs/architecture.md`、`docs/implementation-status.md`、`docs/xhs-review-guide.md`：同步版本、语义和真机验收。

---

### Task 1: 扩展领域契约并建立 v2 → v3 无损迁移

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/validation.ts`
- Modify: `src/domain/versions.ts`
- Modify: `src/storage/migrations.ts`
- Test: `tests/unit/domain.test.ts`
- Test: `tests/unit/migrations.test.ts`
- Test: `tests/unit/case-db.test.ts`
- Test: `tests/unit/draft-store.test.ts`
- Test: `tests/integration/legacy-hint.test.tsx`

**Interfaces:**
- Produces: `QuestionCategory` 新值 `'children' | 'parents' | 'siblings'`。
- Produces: `SCHEMA_VERSION = 3`、`ENGINE_VERSION = '0.2.1'`。
- Produces: `MIGRATIONS[2]` 只更新 `schemaVersion`，不改任何快照字段。

- [ ] **Step 1: 写三个新类别通过领域校验的失败测试**

在 `tests/unit/domain.test.ts` 的 `validateCase` describe 中加入：

```ts
it.each(['children', 'parents', 'siblings'] as const)('accepts the %s relationship category', (category) => {
  const draft = createDraft({
    question: '所问亲属近况如何',
    category,
    castAt,
    method: 'manual',
  })
  expect(validateCase(draft)).toEqual({ ok: true })
})

it('still rejects an unknown relationship category', () => {
  const draft = createDraft({
    question: '所问亲属近况如何',
    category: 'other',
    castAt,
    method: 'manual',
  })
  const result = validateCase({ ...draft, category: 'friend' })
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.issues).toContainEqual({ path: 'category', message: '问题类别无效' })
})
```

- [ ] **Step 2: 写 v2 记录无损迁移的失败测试**

在 `tests/unit/migrations.test.ts` 加入：

```ts
it('v2 记录迁移到 v3 时只更新 schemaVersion，保留类别和快照', () => {
  const chart = { marker: 'keep-this-chart-byte-for-byte' }
  const prompts = [{
    id: 'legacy-prompt',
    variant: 'concise',
    version: '2.1.1',
    content: 'keep-this-prompt-byte-for-byte',
    createdAt: '2026-08-28T04:01:00.000Z',
  }]
  const source = {
    ...validCaseRecord(),
    schemaVersion: 2,
    status: 'cast',
    category: 'career',
    chart,
    prompts,
  }
  const result = migrateCase(source)
  expect(result.mode).toBe('writable')
  if (result.mode === 'writable') {
    expect(result.value.schemaVersion).toBe(3)
    expect(result.value.category).toBe('career')
    expect(result.value.chart).toEqual(chart)
    expect(result.value.prompts).toEqual(prompts)
  }
})
```

同步把原测试名“v1 记录迁移到 v2”改为“v1 记录逐级迁移到当前版本”，最终断言 `schemaVersion === SCHEMA_VERSION`，仍断言 `timeZone.assumed === true`。

同步更新所有明确断言旧记录最终版本为 `2` 的回归测试，使其断言 `SCHEMA_VERSION` 或 `3`：

- `tests/unit/draft-store.test.ts`：旧活动草稿恢复到当前 schema。
- `tests/unit/case-db.test.ts`：`listEntries()` 与 `get()` 读取 v1 记录均逐级迁移到当前 schema。
- `tests/integration/legacy-hint.test.tsx`：历史页旧记录提示仍只出现一次，迁移结果版本为当前 schema，chart 保持不变。

不要修改这些测试对 `timeZone.assumed`、旧 chart 和历史提示文案的断言。

对应的版本断言统一改成：

```ts
expect(result.value.schemaVersion).toBe(3) // migrations.test.ts
expect(loaded?.schemaVersion).toBe(3) // draft-store.test.ts
expect(entry.value.schemaVersion).toBe(3) // case-db.test.ts listEntries
expect(fetched?.schemaVersion).toBe(3) // case-db.test.ts get
expect(stored?.schemaVersion).toBe(3) // legacy-hint.test.tsx
```

- [ ] **Step 3: 运行测试并确认因枚举／迁移缺失而失败**

Run:

```powershell
npx vitest run tests/unit/domain.test.ts tests/unit/migrations.test.ts tests/unit/draft-store.test.ts tests/unit/case-db.test.ts tests/integration/legacy-hint.test.tsx
```

Expected: FAIL；新类别不能通过 TypeScript/validation，v2 记录缺少迁移路径或最终版本不是 3。

- [ ] **Step 4: 最小实现领域枚举、校验和版本迁移**

在 `src/domain/types.ts` 的 union 增加：

```ts
  | 'children'
  | 'parents'
  | 'siblings'
```

在 `src/domain/validation.ts` 的 `CATEGORIES` 增加同名字符串。

在 `src/domain/versions.ts` 设置：

```ts
export const SCHEMA_VERSION = 3
export const ENGINE_VERSION = '0.2.1'
export const PROMPT_VERSION = '2.1.1'
```

在 `src/storage/migrations.ts` 的 `MIGRATIONS` 增加：

```ts
2: (record) => ({
  ...record,
  schemaVersion: 3,
}),
```

- [ ] **Step 5: 重跑领域和迁移测试**

Run: `npx vitest run tests/unit/domain.test.ts tests/unit/migrations.test.ts tests/unit/draft-store.test.ts tests/unit/case-db.test.ts tests/integration/legacy-hint.test.tsx`

Expected: PASS；旧 chart、category、prompt 快照内容均未改变。

- [ ] **Step 6: 提交 Task 1**

```powershell
git add -p -- src/domain/types.ts src/domain/validation.ts src/domain/versions.ts src/storage/migrations.ts tests/unit/domain.test.ts tests/unit/migrations.test.ts tests/unit/draft-store.test.ts tests/unit/case-db.test.ts tests/integration/legacy-hint.test.tsx
git diff --cached
git commit -m "feat: add relative person category contract"
```

---

### Task 2: 在现场摇卦和手动排盘中展示统一选项

**Files:**
- Modify: `src/features/shared/categories.ts`
- Modify: `src/features/cast/QuestionStep.tsx`
- Modify: `src/features/manual/ManualPage.tsx`
- Create: `tests/integration/category-options.test.tsx`

**Interfaces:**
- Consumes: Task 1 的三个 `QuestionCategory` 枚举。
- Produces: `QUESTION_CATEGORY_OPTIONS` 中固定顺序的三个标签。
- Produces: 两个入口共用同一选项源，不再由 `ManualPage` 重复硬编码。

- [ ] **Step 1: 写两个入口都展示新类别和说明的失败测试**

创建 `tests/integration/category-options.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { QuestionStep } from '../../src/features/cast/QuestionStep'
import { ManualPage } from '../../src/features/manual/ManualPage'

const labels = ['子女／晚辈', '父母／长辈', '兄弟姐妹／同辈']

describe('人物关系问题类别', () => {
  it('现场摇卦问题步骤展示三个类别和候选用神说明', () => {
    render(<QuestionStep onSubmit={() => {}} />)
    const select = screen.getByRole('combobox', { name: '问题类别' })
    for (const label of labels) expect(select).toHaveTextContent(label)
    expect(screen.getByText('类别用于推荐主用神候选，具体仍需结合问题确认。')).toBeTruthy()
  })

  it('手动排盘编辑页使用同一组选项', async () => {
    const user = userEvent.setup()
    render(<ManualPage onCaseCreated={() => {}} />)
    await user.type(screen.getByLabelText('你的问题'), '所问亲属近况如何')
    await user.selectOptions(screen.getByLabelText('问题类别'), 'children')
    await user.click(screen.getByRole('button', { name: '下一步' }))
    const select = screen.getByRole('combobox', { name: '问题类别' })
    for (const label of labels) expect(select).toHaveTextContent(label)
    expect(screen.getByText('类别用于推荐主用神候选，具体仍需结合问题确认。')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 运行测试确认新选项缺失**

Run: `npx vitest run tests/integration/category-options.test.tsx`

Expected: FAIL，三个标签和说明不存在。

- [ ] **Step 3: 扩展统一选项表**

在 `src/features/shared/categories.ts` 中把三个选项插在 relationship 之后：

```ts
{ value: 'relationship', label: '感情/婚姻' },
{ value: 'children', label: '子女／晚辈' },
{ value: 'parents', label: '父母／长辈' },
{ value: 'siblings', label: '兄弟姐妹／同辈' },
{ value: 'study', label: '学业/考试' },
```

- [ ] **Step 4: 两个 UI 入口复用选项表并显示说明**

在 `QuestionStep.tsx` 的类别 `label` 后增加：

```tsx
<p className="hint">类别用于推荐主用神候选，具体仍需结合问题确认。</p>
```

在 `ManualPage.tsx` 导入 `QUESTION_CATEGORY_OPTIONS`，将九个内联 `<option>` 替换为：

```tsx
{QUESTION_CATEGORY_OPTIONS.map((option) => (
  <option key={option.value} value={option.value}>{option.label}</option>
))}
```

并在编辑页类别 select 后显示同一句 `<p className="hint">` 说明。

保留文件中现有未提交的导航、状态和错误处理改动，只替换类别选项 hunk。

- [ ] **Step 5: 重跑 UI 测试和既有流程测试**

Run:

```powershell
npx vitest run tests/integration/category-options.test.tsx tests/integration/cast-flow.test.tsx tests/integration/manual-flow.test.tsx
```

Expected: PASS。

- [ ] **Step 6: 提交 Task 2**

```powershell
git add -p -- src/features/shared/categories.ts src/features/cast/QuestionStep.tsx src/features/manual/ManualPage.tsx
git add -- tests/integration/category-options.test.tsx
git diff --cached
git commit -m "feat: show relative person categories"
```

---

### Task 3: 新增候选用神映射和复合风险提示

**Files:**
- Modify: `src/engines/interpretation/categories.ts`
- Modify: `src/engines/interpretation/disclaimers.ts`
- Modify: `tests/unit/interpretation.test.ts`

**Interfaces:**
- Consumes: 三个新 `QuestionCategory`。
- Produces: `YONGSHEN_BY_CATEGORY.children/parents/siblings`。
- Produces: 三类统一复合风险免责声明。

- [ ] **Step 1: 写候选映射和风险提示的失败测试**

在 `tests/unit/interpretation.test.ts` 加入：

```ts
it.each([
  ['children', '子孙'],
  ['parents', '父母'],
  ['siblings', '兄弟'],
] as const)('%s uses %s as its primary candidate', (category, liuqin) => {
  expect(YONGSHEN_BY_CATEGORY[category].primary).toEqual([liuqin])
  expect(YONGSHEN_BY_CATEGORY[category].note).toContain('主用神候选')
  expect(YONGSHEN_BY_CATEGORY[category].note).toContain('辅助六亲')
})

it.each(['children', 'parents', 'siblings'] as const)('%s keeps compound-risk guidance', (category) => {
  const chart = buildChart([7, 7, 7, 7, 7, 7], CAST_AT)
  const text = interpret(chart, category).disclaimers.join('\n')
  expect(text).toContain('健康')
  expect(text).toContain('法律')
  expect(text).toContain('财务')
  expect(text).toContain('不能替代专业意见')
})

it('新增类别沿用现有用神出现、伏藏和多现规则', () => {
  const children = interpret(buildChart([7, 7, 7, 7, 7, 7], CAST_AT), 'children')
    .observations.find((item) => item.ruleId === 'yongshen-visibility')!
  expect(children.observation).toContain('出现')
  expect(children.linePositions).toEqual([1])

  const parents = interpret(buildChart([7, 8, 8, 8, 8, 8], CAST_AT), 'parents')
    .observations.find((item) => item.ruleId === 'yongshen-visibility')!
  expect(parents.observation).toContain('伏藏')
  expect(parents.linePositions).toEqual([2])

  const siblings = interpret(buildChart([6, 7, 7, 7, 7, 7], CAST_AT), 'siblings')
    .observations.find((item) => item.ruleId === 'yongshen-visibility')!
  expect(siblings.observation).toContain('多现')
  expect(siblings.linePositions).toEqual([3, 5])
})
```

把 `ALL_CATEGORIES` 扩展为十二类，把“九类问题都有候选用神”的测试名改为“十二类问题都有候选用神”，确保现有禁语扫描也覆盖新增类别。

- [ ] **Step 2: 运行测试确认映射缺失**

Run: `npx vitest run tests/unit/interpretation.test.ts`

Expected: FAIL，`YONGSHEN_BY_CATEGORY` 缺少三个键。

- [ ] **Step 3: 实现三类 YongshenSpec**

在 `src/engines/interpretation/categories.ts` 增加：

```ts
children: {
  primary: ['子孙'],
  note: '所问对象为问卦人的子女或晚辈，通常以子孙爻为主用神候选；若兼问健康、学业、婚恋或工作，需结合问题原文观察相关辅助六亲。',
},
parents: {
  primary: ['父母'],
  note: '所问对象为问卦人的父母或长辈，通常以父母爻为主用神候选；若兼问健康、出行、财务或其他事项，需结合问题原文观察相关辅助六亲。',
},
siblings: {
  primary: ['兄弟'],
  note: '所问对象为问卦人的兄弟姐妹或同辈，通常以兄弟爻为主用神候选；若兼问健康、事业、婚恋或财务，需结合问题原文观察相关辅助六亲。',
},
```

同时把文件头注释中的“九类问题”改为“十二类问题”，并注明新增人物关系类返回主用神候选、复合事项仍需结合原问题确认辅助六亲。

- [ ] **Step 4: 实现人物关系类复合风险提示**

在 `disclaimers.ts` 定义：

```ts
const RELATIVE_RISK_DISCLAIMER =
  '如问题涉及健康、法律或财务事项，请咨询相应专业人士，卦象内容不能替代专业意见。'
```

在 switch 中让 `children`、`parents`、`siblings` 返回 `[BASE_DISCLAIMER, RELATIVE_RISK_DISCLAIMER]`；现有 health/dispute/wealth 分支保持原文不变。

- [ ] **Step 5: 重跑解释层测试**

Run: `npx vitest run tests/unit/interpretation.test.ts`

Expected: PASS；十二类均通过禁语扫描。

- [ ] **Step 6: 提交 Task 3**

```powershell
git add -p -- src/engines/interpretation/categories.ts src/engines/interpretation/disclaimers.ts tests/unit/interpretation.test.ts
git diff --cached
git commit -m "feat: map relative categories to yongshen candidates"
```

---

### Task 4: 更新提示词标签、候选语义和 promptVersion

**Files:**
- Modify: `src/engines/prompt/templates.ts`
- Modify: `src/engines/prompt/engine.ts`
- Modify: `src/domain/versions.ts`
- Modify: `tests/unit/prompt.test.ts`
- Modify: `tests/unit/prompt-structured.test.ts`

**Interfaces:**
- Consumes: `YONGSHEN_BY_CATEGORY` 的新增映射和说明。
- Produces: `CATEGORY_LABEL.children/parents/siblings`。
- Produces: `PROMPT_VERSION = '2.2.0'`。
- Produces: 两种提示词统一的 `主用神候选：...` 字段。

- [ ] **Step 1: 写精简版和专业版提示词失败测试**

在 `tests/unit/prompt.test.ts` 导入 `QuestionCategory`，把工厂签名和两处硬编码改为：

```ts
function buildCase(category: QuestionCategory = 'career'): DivinationCase {
  const rawValues = [6, 7, 7, 7, 7, 7] as const
  const draft = createDraft({
    question: '跳槽顺利吗',
    category,
    castAt: CAST_AT.toISOString(),
    method: 'simulated-coins',
  })
  const chart = buildChart(rawValues, CAST_AT)
  return {
    ...draft,
    status: 'cast',
    rawValues: [...rawValues],
    coinThrows: rawValues.map((rawValue, index) => ({
      round: (index + 1) as CoinThrow['round'],
      faces: rawValue === 6 ? ([0, 0, 0] as const) : ([1, 1, 0] as const),
      rawValue,
    })),
    chart,
    observations: interpret(chart, category).observations,
  }
}
```

然后加入：

```ts
it.each([
  ['children', '子女／晚辈', '子孙'],
  ['parents', '父母／长辈', '父母'],
  ['siblings', '兄弟姐妹／同辈', '兄弟'],
] as const)('%s prompt exposes a candidate instead of a final yongshen', (category, label, liuqin) => {
  for (const variant of ['concise', 'professional'] as const) {
    const content = generatePrompt(buildCase(category), variant).content
    expect(content).toContain(`类别：${label}`)
    expect(content).toContain(`主用神候选：${liuqin}`)
    expect(content).not.toMatch(/\n用神：/)
  }
})
```

在 `tests/unit/prompt-structured.test.ts` 同样导入 `QuestionCategory` 与 `PROMPT_VERSION`，把工厂替换为：

```ts
function buildCase(category: QuestionCategory = 'career'): DivinationCase {
  const rawValues = [6, 7, 7, 7, 7, 7] as const
  const draft = createDraft({
    question: '跳槽顺利吗',
    category,
    castAt: CAST_AT.toISOString(),
    method: 'manual',
  })
  const chart = buildChart(rawValues, CAST_AT, {
    lines: { 1: { liushen: '人工六神', fushen: { liuqin: '父母', zhi: '子' } } },
  })
  return { ...draft, status: 'cast', rawValues: [...rawValues], chart, observations: [] }
}
```

加入：

```ts
it('keeps the stable relationship category and prompt version in structured JSON', () => {
  const value = buildCase('children')
  const structured = buildStructuredPromptData(value)
  expect(structured.category).toBe('children')
  expect(structured.promptVersion).toBe(PROMPT_VERSION)

  const content = generatePrompt(value, 'professional').content
  const json = JSON.parse(content.split('```json\n')[1].split('\n```')[0])
  expect(json.category).toBe('children')
  expect(json.promptVersion).toBe(PROMPT_VERSION)
})
```

- [ ] **Step 2: 运行提示词测试确认失败**

Run: `npx vitest run tests/unit/prompt.test.ts tests/unit/prompt-structured.test.ts`

Expected: FAIL，标签缺失且仍输出“用神”。

- [ ] **Step 3: 增加三个提示词标签**

在 `CATEGORY_LABEL` 增加：

```ts
children: '子女／晚辈',
parents: '父母／长辈',
siblings: '兄弟姐妹／同辈',
```

- [ ] **Step 4: 收紧字段名并提升提示词版本**

在 `engine.ts` 的 concise/professional 两处把：

```ts
`用神：${YONGSHEN_BY_CATEGORY[caseValue.category].primary.join(' / ')}`
```

改为：

```ts
`主用神候选：${YONGSHEN_BY_CATEGORY[caseValue.category].primary.join(' / ')}`
```

保留 professional 的 `说明：${spec.note}`。修改该文件前先检查并保留当前未提交的错误处理或提示词改动。

在 `versions.ts` 只把：

```ts
export const PROMPT_VERSION = '2.2.0'
```

- [ ] **Step 5: 重跑提示词测试**

Run: `npx vitest run tests/unit/prompt.test.ts tests/unit/prompt-structured.test.ts`

Expected: PASS。

- [ ] **Step 6: 提交 Task 4**

```powershell
git add -p -- src/engines/prompt/templates.ts src/engines/prompt/engine.ts src/domain/versions.ts tests/unit/prompt.test.ts tests/unit/prompt-structured.test.ts
git diff --cached
git commit -m "feat: describe yongshen as prompt candidates"
```

---

### Task 5: 固化草稿、仓库和备份往返兼容

**Files:**
- Modify: `tests/unit/manual-draft-store.test.ts`
- Modify: `tests/unit/draft-store.test.ts`
- Modify: `tests/unit/case-db.test.ts`
- Modify: `tests/unit/backup-format.test.ts`

**Interfaces:**
- Consumes: schema v3 和三个新 category。
- Produces: 新类别在活动草稿、手排草稿、IndexedDB 和文本备份中原样往返。

- [ ] **Step 1: 写四种持久化往返测试**

在 `tests/unit/manual-draft-store.test.ts` 加入：

```ts
it('round-trips a relative category', () => {
  const snapshot = buildManualDraft({ category: 'children' })
  manualDraftStore.save(snapshot)
  expect(manualDraftStore.load()?.category).toBe('children')
})
```

在 `tests/unit/draft-store.test.ts` 加入：

```ts
it('round-trips a relative category', () => {
  vi.stubGlobal('localStorage', memoryStorage())
  const draft = { ...buildDraft(), category: 'parents' as const }
  draftStore.save(draft)
  expect(draftStore.load()?.category).toBe('parents')
})
```

在 `tests/unit/case-db.test.ts` 加入：

```ts
it('round-trips a relative category', async () => {
  const repository = repo()
  const value = buildSavedCase({ category: 'siblings' })
  await repository.put(value)
  expect((await repository.get(value.id))?.category).toBe('siblings')
})
```

在 `tests/unit/backup-format.test.ts` 加入：

```ts
it('round-trips a relative category', () => {
  const entry = writableEntry()
  expect(entry.mode).toBe('writable')
  if (entry.mode !== 'writable') return
  const value = { ...entry.value, category: 'children' as const }
  const text = formatBackup([{ mode: 'writable', value }], { exportedAt: value.updatedAt })
  const parsed = parseBackup(text)
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) return
  expect(parsed.value.records[0]?.category).toBe('children')
})
```

每个测试都用真实 `createDraft`/repository/formatBackup API，不复制生产序列化逻辑。

- [ ] **Step 2: 运行持久化测试**

Run:

```powershell
npx vitest run tests/unit/manual-draft-store.test.ts tests/unit/draft-store.test.ts tests/unit/case-db.test.ts tests/unit/backup-format.test.ts
```

Expected: PASS。现有三个存储实现都整体序列化记录，本任务用回归测试锁定这一兼容不变量，不增加专用生产分支。

- [ ] **Step 3: 检查测试只依赖真实公共 API**

确认测试均通过 `manualDraftStore`、`draftStore`、repository 和 `formatBackup/parseBackup` 往返，没有在测试中手写一份生产序列化器。生产代码继续保持：

```ts
// 保持整体对象序列化；禁止为三个新值建立特殊 category 映射。
JSON.stringify(snapshot)
```

不要更改备份格式版本；JSON 行已能承载新枚举，恢复时由 schema 迁移与 `validateCase` 判断。

- [ ] **Step 4: 重跑持久化测试并提交**

Run: 同 Step 2，Expected: PASS。

```powershell
git add -p -- tests/unit/manual-draft-store.test.ts tests/unit/draft-store.test.ts tests/unit/case-db.test.ts tests/unit/backup-format.test.ts
git diff --cached
git commit -m "test: cover relative category persistence"
```

---

### Task 6: 增加端到端验收、更新文档并运行全量门禁

**Files:**
- Create: `tests/e2e/relative-categories.spec.ts`
- Modify: `docs/architecture.md`
- Modify: `docs/implementation-status.md`
- Modify: `docs/xhs-review-guide.md`

**Interfaces:**
- Consumes: 前五个任务的完整用户流程。
- Produces: 浏览器级选择／保存证据、版本文档和真机清单。

- [ ] **Step 1: 写 E2E 用例覆盖两个入口**

创建 `tests/e2e/relative-categories.spec.ts`，完整包含以下两个用例：

```ts
import { expect, test } from '@playwright/test'

test('现场摇卦可选择子女类别并在提示词中保留候选用神', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '现场摇卦' }).click()
  await page.getByLabel('你的问题').fill('孩子这次考试准备得如何')
  await page.getByLabel('问题类别').selectOption('children')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('button', { name: '模拟铜钱摇卦' }).click()
  for (let i = 0; i < 6; i += 1) await page.getByRole('button', { name: '摇动铜钱' }).click()
  await page.getByRole('button', { name: '生成结果' }).click()
  await page.getByRole('button', { name: /生成精简版提示词/ }).click()
  await expect(page.getByLabel('提示词内容')).toContainText('类别：子女／晚辈')
  await expect(page.getByLabel('提示词内容')).toContainText('主用神候选：子孙')
})

test('手动排盘可选择兄弟姐妹类别并生成专业提示词', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '手动排盘' }).click()
  await page.getByLabel('你的问题').fill('兄弟这次换工作是否顺利')
  await page.getByLabel('问题类别').selectOption('siblings')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('combobox', { name: '搜索卦名' }).fill('泰')
  await page.getByRole('option', { name: '地天泰' }).click()
  await page.getByRole('button', { name: '生成正式结果' }).click()
  await page.getByRole('button', { name: '生成专业版提示词' }).click()
  const prompt = page.getByLabel('提示词内容')
  await expect(prompt).toContainText('类别：兄弟姐妹／同辈')
  await expect(prompt).toContainText('主用神候选：兄弟')
  await expect(prompt).toContainText('辅助六亲')
})
```

- [ ] **Step 2: 运行新 E2E，确认实现存在且 locator 正确**

Run: `npx playwright test tests/e2e/relative-categories.spec.ts`

Expected: PASS。上述 locator 与现有 E2E 使用的 accessible name 保持一致；不得改用脆弱的 CSS nth-child。

- [ ] **Step 3: 更新架构与实施状态**

在 `docs/architecture.md`：

- 版本表改为 schema 3、engine 0.2.1、prompt 2.2.0。
- 说明 v2 → v3 只扩展问题类别并保持旧快照。
- 记录“人物关系类别给主用神候选，复合事项由问题原文和外部 AI 继续确认”。

在 `docs/implementation-status.md` 新增“2026-11-04 人物关系类别扩展”小节，记录三个类别、版本变化、兼容策略和最终实测数字。不要覆盖当前工作区已经存在但未提交的其他实施记录。

在 `docs/xhs-review-guide.md` 增加真机项：现场和手排各选一个新类别；检查原生类别弹层标签完整；生成提示词；备份恢复后类别不丢；旧记录仍可读。

- [ ] **Step 4: 串行运行完整自动化门禁**

不要并行运行三组 Vitest：集成测试会共享和重建 `dist/`。

Run in order:

```powershell
npm run lint
npm test
$env:TZ='UTC'; npm test
$env:TZ='America/New_York'; npm test
Remove-Item Env:TZ -ErrorAction SilentlyContinue
npm run build
npm run test:e2e
git diff --check
```

Expected:

- lint 0 error。
- 三个时区测试数量一致且 0 failure。
- build 输出 `0 violations`。
- Playwright 0 failure。
- `git diff --check` 无输出。

- [ ] **Step 5: 检查旧快照和工作区边界**

Run:

```powershell
git diff -- src/domain/types.ts src/domain/validation.ts src/domain/versions.ts src/storage/migrations.ts src/features/shared/categories.ts src/features/cast/QuestionStep.tsx src/features/manual/ManualPage.tsx src/engines/interpretation/categories.ts src/engines/interpretation/disclaimers.ts src/engines/prompt/templates.ts src/engines/prompt/engine.ts
git status --short
```

确认没有重算旧 chart、没有批量改写 fixtures、没有把 `.playwright-cli/` 或用户已有未提交文件误纳入提交。

- [ ] **Step 6: 提交 Task 6**

```powershell
git add -- tests/e2e/relative-categories.spec.ts
git add -p -- docs/architecture.md docs/implementation-status.md docs/xhs-review-guide.md
git diff --cached
git commit -m "docs: record relative person category support"
```

---

## Final Review Checklist

- [ ] 三个新类别的英文值、中文标签和顺序完全一致。
- [ ] 子女／父母／兄弟分别只映射子孙／父母／兄弟主用神候选。
- [ ] 所有用户可见提示词均使用“主用神候选”。
- [ ] 三个关系类均保留复合高风险提醒。
- [ ] v1 → v2 → v3 与 v2 → v3 迁移均通过，旧快照逐字段不变。
- [ ] 现场、手排、历史、备份恢复和提示词快照可往返新类别。
- [ ] schema/engine/prompt 版本与文档一致。
- [ ] 用户现有未提交改动未被覆盖或误提交。
- [ ] 不重新打包，除非用户在实现完成后另行要求。
