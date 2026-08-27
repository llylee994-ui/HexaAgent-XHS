# 问爻小红书离线六爻工具实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `D:\HexaAgent-XHS` 构建一个可上传至小红书小工具容器、完全离线运行的六爻起卦、排盘、规则初判、AI 提示词与卦例归档应用。

**Architecture:** 应用采用 React、TypeScript 与 Vite，业务内核由无 UI、无副作用的纯函数模块组成，页面只通过 `DivinationCase` 与应用服务交互。IndexedDB 保存正式卦例，localStorage 保存设置和单个未完成草稿；构建后使用静态扫描阻止网络、外部资源、内联脚本、Worker、WASM 和下载能力进入上传包。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest、Testing Library、fake-indexeddb、Playwright、ESLint、原生 IndexedDB、CSS。

## Global Constraints

- 目标仓库固定为 `D:\HexaAgent-XHS`，远程仓库固定为 `git@github.com:llylee994-ui/HexaAgent-XHS.git`。
- 来源仓库 `D:\HexaAgent` 保持不变；只移植可验证的排盘算法和必要视觉资产。
- 不得复制或引入 Python 后端、FastAPI、API Key、LangGraph、DeepSeek、向量知识库、在线会话数据或用户数据。
- 运行时不得发起 `fetch`、XMLHttpRequest、WebSocket、EventSource、WebRTC 或任何外部资源请求。
- 不得使用内联脚本、行内事件、`eval`、`new Function`、Web Worker、Service Worker、WebAssembly、iframe、文件下载或外链跳转。
- 最终产物必须只有一个 HTML 入口，所有 JS、CSS、图片、字体和 JSON 均来自包内。
- 六爻数组始终按初爻到上爻排序，索引 `0..5` 对应爻位 `1..6`。
- 变卦六亲始终以本卦卦宫五行为计算基准。
- 所有预测性文案保持克制；健康、法律和财务问题不得替代专业意见。
- 每项任务均遵循红—绿—重构测试循环，提交前运行该任务列出的验证命令。

---

## 文件结构

```text
D:\HexaAgent-XHS\
├── docs/
│   ├── architecture.md                 模块边界、数据流和版本策略
│   ├── algorithm.md                    排盘公式、来源与固定案例
│   ├── privacy.md                      离线数据和隐私说明
│   ├── xhs-review-guide.md             打包、上传和审核操作说明
│   └── superpowers/{specs,plans}/      设计规格与本实施计划
├── scripts/
│   └── verify-xhs-build.mjs            扫描构建产物的不兼容能力
├── src/
│   ├── app/                            路由状态、页面装配和错误边界
│   ├── domain/                         共享类型、常量和版本号
│   ├── engines/
│   │   ├── divination/                 铜钱与爻值转换
│   │   ├── hexagram/                   八卦、六十四卦和变卦
│   │   ├── calendar/                   四柱和旬空
│   │   ├── najia/                      纳甲、六亲、六神、世应、伏神
│   │   ├── interpretation/             可解释离线规则
│   │   └── prompt/                     两种提示词
│   ├── storage/                        localStorage、IndexedDB、迁移
│   ├── features/                       首页、起卦、手排、结果、历史
│   ├── components/                     共用卡片、爻线、表单和提示
│   └── styles/                         设计令牌和全局样式
├── tests/
│   ├── fixtures/                       固定卦例
│   ├── unit/                           纯函数和存储测试
│   ├── integration/                    主流程测试
│   └── e2e/                            移动端端到端测试
├── index.html
├── package.json
├── tsconfig*.json
├── vite.config.ts
└── playwright.config.ts
```

## 核心接口约定

```ts
export type YinYang = 'yin' | 'yang'
export type RawYaoValue = 6 | 7 | 8 | 9
export type QuestionCategory =
  | 'career' | 'wealth' | 'relationship' | 'study' | 'health'
  | 'dispute' | 'travel' | 'lost-item' | 'other'

export interface CoinThrow {
  round: 1 | 2 | 3 | 4 | 5 | 6
  faces: readonly [0 | 1, 0 | 1, 0 | 1]
  rawValue: RawYaoValue
}

export interface YaoLine {
  position: 1 | 2 | 3 | 4 | 5 | 6
  rawValue: RawYaoValue
  type: YinYang
  changing: boolean
  gan: string
  zhi: string
  wuxing: string
  liuqin: string
  liushen: string
  shiYing: 'shi' | 'ying' | null
  xunKong: boolean
  fushen: { liuqin: string; zhi: string } | null
}

export interface DivinationCase {
  id: string
  schemaVersion: number
  engineVersion: string
  status: 'draft' | 'cast' | 'prompted' | 'answered' | 'verified'
  question: string
  category: QuestionCategory
  note: string
  castAt: string
  method: 'simulated-coins' | 'physical-coins' | 'manual'
  coinThrows: CoinThrow[]
  rawValues: RawYaoValue[]
  chart: HexagramChart | null
  observations: InterpretationObservation[]
  prompts: PromptSnapshot[]
  answers: AiAnswer[]
  title: string
  tags: string[]
  verification: string
  createdAt: string
  updatedAt: string
  parentCaseId: string | null
}
```

---

### Task 1: 工程基线与小红书构建护栏

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`
- Create: `src/main.tsx`, `src/app/App.tsx`, `src/styles/tokens.css`, `src/styles/global.css`
- Create: `scripts/verify-xhs-build.mjs`
- Test: `tests/unit/verify-xhs-build.test.ts`

**Interfaces:**
- Produces: `npm run dev`, `npm test`, `npm run build`, `npm run verify:xhs`。
- Produces: 构建扫描器 `scanBuild(root: string): Promise<Violation[]>`，其中 `Violation` 含 `file`、`rule`、`match`。

- [ ] **Step 1: 写构建扫描器失败测试**

  在临时 `dist` 中分别写入外部 URL、`fetch(`、`new Worker(`、`WebAssembly`、`<script>内联内容</script>` 和安全的相对资源；断言前五项被报告，安全文件不报错。

- [ ] **Step 2: 运行测试确认失败**

  Run: `npm test -- tests/unit/verify-xhs-build.test.ts`
  Expected: FAIL，原因是 `scripts/verify-xhs-build.mjs` 尚不存在。

- [ ] **Step 3: 创建最小 Vite 工程与扫描器**

  `package.json` 固定脚本：`dev: vite --host 0.0.0.0`、`test: vitest run`、`test:watch: vitest`、`build: tsc -b && vite build && npm run verify:xhs`、`verify:xhs: node scripts/verify-xhs-build.mjs dist`、`lint: eslint .`。扫描器递归读取 HTML/CSS/JS/JSON，匹配 `https?://`、网络 API、Worker、WASM、`eval`、`new Function`、iframe、`download=`、`target=_blank`，并解析 HTML 确认所有脚本均有本地 `src` 且无内联正文。

- [ ] **Step 4: 建立应用壳与设计令牌**

  定义米白 `--paper`、墨黑 `--ink`、朱砂 `--cinnabar`、茶绿 `--tea`、暖褐 `--earth`、安全区 padding、44px 最小点击区和 `prefers-reduced-motion` 降级；`App` 暂时渲染“问爻”标题。

- [ ] **Step 5: 验证基线**

  Run: `npm test && npm run lint && npm run build`
  Expected: 全部通过，`dist/index.html` 只引用相对路径资源。

- [ ] **Step 6: 提交**

  Run: `git add . && git commit -m "chore: establish offline XHS app baseline"`

---

### Task 2: 领域模型、版本与固定案例

**Files:**
- Create: `src/domain/types.ts`, `src/domain/versions.ts`, `src/domain/factories.ts`, `src/domain/validation.ts`
- Create: `tests/fixtures/hexagram-cases.ts`
- Test: `tests/unit/domain.test.ts`

**Interfaces:**
- Produces: 本计划“核心接口约定”中的所有类型。
- Produces: `createDraft(input): DivinationCase`、`validateCase(value): ValidationResult`、常量 `SCHEMA_VERSION`、`ENGINE_VERSION`、`PROMPT_VERSION`。

- [ ] **Step 1: 写领域模型测试**

  覆盖新草稿默认值、六个爻值的长度/枚举校验、ISO 时间、正式结果必须有 `chart`、回答必须关联 `promptId`，以及已有卦修改副本必须填写 `parentCaseId`。

- [ ] **Step 2: 运行测试确认失败**

  Run: `npm test -- tests/unit/domain.test.ts`
  Expected: FAIL，原因是领域模块不存在。

- [ ] **Step 3: 实现类型、工厂与显式校验结果**

  `ValidationResult` 使用 `{ ok: true } | { ok: false; issues: { path: string; message: string }[] }`，不得通过异常表达正常的表单缺失。

- [ ] **Step 4: 建立固定案例集**

  至少包含乾为天静卦 `[7,7,7,7,7,7]`、坤为地六爻皆动 `[6,6,6,6,6,6]`、天风姤初爻动、一个多爻动案例；每项明确本卦、变卦、动爻和本卦卦宫。

- [ ] **Step 5: 验证并提交**

  Run: `npm test -- tests/unit/domain.test.ts && git add src/domain tests/fixtures tests/unit/domain.test.ts && git commit -m "feat: define versioned divination case model"`

---

### Task 3: 铜钱起卦与六十四卦内核

**Files:**
- Create: `src/engines/divination/coins.ts`
- Create: `src/engines/hexagram/trigrams.ts`, `src/engines/hexagram/table.ts`, `src/engines/hexagram/engine.ts`
- Test: `tests/unit/coins.test.ts`, `tests/unit/hexagram-engine.test.ts`

**Interfaces:**
- Produces: `facesToRawValue(faces): RawYaoValue`、`rawValueToLine(value): { type; changing }`、`throwCoins(random?: () => number): CoinThrow['faces']`。
- Produces: `buildHexagram(rawValues: readonly RawYaoValue[]): BasicHexagramChart`、`identifyHexagram(lines): HexagramIdentity`。

- [ ] **Step 1: 写铜钱换算测试**

  明确约定正面为 3、反面为 2，因此三反为 6、两反一正为 7、一反两正为 8、三正为 9；用注入的伪随机序列验证可重复结果。

- [ ] **Step 2: 写卦象识别与变卦测试**

  遍历 64 个上下卦组合，断言名称唯一；遍历动爻数量 0..6，断言仅 6/9 翻转；静卦 `changed` 为 `null`，六爻皆动设置 `allChanging: true`。

- [ ] **Step 3: 运行测试确认失败**

  Run: `npm test -- tests/unit/coins.test.ts tests/unit/hexagram-engine.test.ts`
  Expected: FAIL，原因是内核未实现。

- [ ] **Step 4: 从来源项目移植并规范化数据表**

  参考 `D:\HexaAgent\frontend\src\utils\hexagrams.ts` 和 `D:\HexaAgent\backend\app\core\bagua.py`，只迁移八卦爻象、64 卦名称、卦宫、世位和纯函数；禁止复制任何 API 或状态代码。

- [ ] **Step 5: 实现单一计算入口并验证**

  Run: `npm test -- tests/unit/coins.test.ts tests/unit/hexagram-engine.test.ts`
  Expected: 64 卦表、四种爻值和全部动爻组合通过。

- [ ] **Step 6: 提交**

  Run: `git add src/engines/divination src/engines/hexagram tests/unit && git commit -m "feat: add coin and hexagram engines"`

---

### Task 4: 四柱、纳甲与完整排盘管线

**Files:**
- Create: `src/engines/calendar/ganzhi.ts`, `src/engines/calendar/calendar.ts`
- Create: `src/engines/najia/nazhi.ts`, `liuqin.ts`, `liushen.ts`, `shiying.ts`, `fushen.ts`, `chart.ts`
- Test: `tests/unit/calendar.test.ts`, `tests/unit/najia.test.ts`, `tests/unit/chart.test.ts`

**Interfaces:**
- Produces: `calculateSizhu(date: Date): Sizhu`、`getXunKong(dayPillar: string): readonly [string,string]`。
- Produces: `buildChart(rawValues, castAt, overrides?): HexagramChart`，作为所有录入方式唯一的正式排盘入口。

- [ ] **Step 1: 写四柱和旬空固定日期测试**

  覆盖立春前后、节气月边界、23 点子时、1900-01-01 基准日和六个旬首；把当前来源项目的近似节气算法标记为首版兼容实现，并在 `docs/algorithm.md` 记录 ±1 日边界风险。

- [ ] **Step 2: 写纳甲、六亲、六神与世应测试**

  逐个验证八卦内外卦纳支；验证五行五种关系；验证十日干对应六神起位；遍历世位 1..6 验证应位隔三爻。

- [ ] **Step 3: 写完整排盘测试**

  对固定案例断言每条本卦/变卦爻均有干、支、五行、六亲、六神、世应与旬空；特别断言变卦六亲使用本卦卦宫，而非变卦卦宫。

- [ ] **Step 4: 运行测试确认失败**

  Run: `npm test -- tests/unit/calendar.test.ts tests/unit/najia.test.ts tests/unit/chart.test.ts`
  Expected: FAIL，原因是排盘模块不存在。

- [ ] **Step 5: 移植纯算法并实现管线**

  参考 `D:\HexaAgent\backend\app\core\{ganzhi,sizhu,najia,liuqin,liushen,shiying,xunkong,paipan}.py`，将原地修改改为返回新对象的 TypeScript 纯函数；专业覆盖字段只在 `buildChart` 最后合并，保留 `computed` 与 `overridden` 来源标记。

- [ ] **Step 6: 实现伏神**

  依据本宫纯卦的六亲映射补齐本卦缺失六亲，结果为 `null` 或 `{ liuqin, zhi }`；添加“用神未现但伏藏”的固定案例。

- [ ] **Step 7: 验证并提交**

  Run: `npm test -- tests/unit/calendar.test.ts tests/unit/najia.test.ts tests/unit/chart.test.ts && git commit -am "feat: add complete offline chart engine"`

---

### Task 5: 草稿、IndexedDB 卦例与版本迁移

**Files:**
- Create: `src/storage/draft-store.ts`, `src/storage/case-db.ts`, `src/storage/migrations.ts`, `src/storage/errors.ts`
- Test: `tests/unit/draft-store.test.ts`, `tests/unit/case-db.test.ts`, `tests/unit/migrations.test.ts`

**Interfaces:**
- Produces: `draftStore.load/save/clear()`。
- Produces: `caseRepository.list/get/put/delete/search/duplicate()`。
- Produces: `migrateCase(record): { mode: 'writable'; value } | { mode: 'readonly'; raw; reason }`。

- [ ] **Step 1: 写草稿恢复测试**

  使用内存 Storage 覆盖保存、刷新恢复、损坏 JSON 清理、仅保留一个活动草稿和六爻未完成状态。

- [ ] **Step 2: 写 IndexedDB 仓储测试**

  使用 `fake-indexeddb` 覆盖增删改查、按更新时间倒序、标题/问题/卦名/标签搜索、多个 AI 回答不覆盖、复制版本写入 `parentCaseId`。

- [ ] **Step 3: 写迁移与容量错误测试**

  覆盖当前版本直读、旧版本逐级迁移、未知未来版本只读、迁移异常只读、`QuotaExceededError` 转换为可展示的 `StorageFullError` 且不删除旧记录。

- [ ] **Step 4: 运行测试确认失败并实现**

  Run: `npm test -- tests/unit/draft-store.test.ts tests/unit/case-db.test.ts tests/unit/migrations.test.ts`
  Expected before implementation: FAIL；实现后 PASS。

- [ ] **Step 5: 提交**

  Run: `git add src/storage tests/unit && git commit -m "feat: persist drafts and versioned cases offline"`

---

### Task 6: 起卦与手动排盘交互

**Files:**
- Create: `src/app/navigation.ts`, `src/app/use-case-session.ts`
- Create: `src/features/home/HomePage.tsx`
- Create: `src/features/cast/{QuestionStep,MethodStep,CoinStage,PhysicalCoinStage,CastPage}.tsx`
- Create: `src/features/manual/{QuickEntry,ProfessionalEditor,ManualPage}.tsx`
- Create: `src/components/{Coin,CoinRound,YaoStack,ProgressHeader,ConfirmDialog}.tsx`
- Test: `tests/integration/cast-flow.test.tsx`, `tests/integration/manual-flow.test.tsx`

**Interfaces:**
- Consumes: `createDraft`、铜钱引擎、`buildChart`、`draftStore`。
- Produces: 完成或未完成的 `DivinationCase`，并导航到结果页。

- [ ] **Step 1: 写现场摇卦流程测试**

  断言先填写问题/类别，再选择模拟或现实投币；每轮保留三枚正反面与爻值；支持撤销；第六爻后生成结果；修改已完成爻必须确认；卸载页面后草稿可恢复。

- [ ] **Step 2: 写手动排盘流程测试**

  覆盖直接输入 6/7/8/9、阴阳+动静等价输入、实时预览、专业字段默认折叠、字段覆盖、缺失字段只允许保存草稿且阻止正式结果。

- [ ] **Step 3: 运行测试确认失败**

  Run: `npm test -- tests/integration/cast-flow.test.tsx tests/integration/manual-flow.test.tsx`
  Expected: FAIL，原因是页面不存在。

- [ ] **Step 4: 实现单一会话状态机**

  状态限定为 `question -> method -> casting -> review -> result`；所有页面事件转为显式 action，任何方式最终只写入 `rawValues` 并调用同一个 `buildChart`。

- [ ] **Step 5: 实现可访问交互和动画降级**

  铜钱按钮提供文本状态和 `aria-label`；动画仅 CSS；减少动态设置下取消翻转；进度始终显示“第 N 爻 / 共六爻”和问题摘要。

- [ ] **Step 6: 验证并提交**

  Run: `npm test -- tests/integration/cast-flow.test.tsx tests/integration/manual-flow.test.tsx && git add src tests/integration && git commit -m "feat: add casting and manual chart flows"`

---

### Task 7: 可解释离线初判引擎

**Files:**
- Create: `src/engines/interpretation/categories.ts`, `rules.ts`, `relations.ts`, `engine.ts`, `disclaimers.ts`
- Test: `tests/unit/interpretation.test.ts`

**Interfaces:**
- Produces: `interpret(chart, category): InterpretationResult`。
- `InterpretationObservation` 固定含 `ruleId`、`observation`、`basis`、`tendency: 'supportive'|'resistant'|'mixed'|'neutral'`、`linePositions`。

- [ ] **Step 1: 写类别用神映射测试**

  对九类问题分别断言候选用神；感情等存在上下文差异的类别返回候选集合和需要用户确认的说明，不自行推断用户性别或角色。

- [ ] **Step 2: 写规则顺序与依据测试**

  覆盖用神出现/伏藏/多现、月日生扶冲克、旬空/月破/日破、世应关系、动变和回头生克、静卦/一动/多动/六爻皆动。

- [ ] **Step 3: 写冲突与高风险文案测试**

  支持与阻力并存时总结必须为“信号复杂”；输出不得包含“一定”“必然”“保证成功”“确诊”；健康、法律、财务类别必须附专门提示。

- [ ] **Step 4: 运行失败测试并实现规则注册表**

  Run: `npm test -- tests/unit/interpretation.test.ts`
  Expected before implementation: FAIL；实现后每条命中结果均可由 `ruleId` 回溯。

- [ ] **Step 5: 提交**

  Run: `git add src/engines/interpretation tests/unit/interpretation.test.ts && git commit -m "feat: add explainable offline interpretation rules"`

---

### Task 8: AI 提示词、回答回填与结果卡

**Files:**
- Create: `src/engines/prompt/templates.ts`, `formatter.ts`, `engine.ts`
- Create: `src/features/result/{ResultPage,HeroCard,Observations,FullChart,ReferenceText,PromptPanel,AnswerPanel,SavePanel}.tsx`
- Create: `src/components/{HexagramLines,YaoCard,Disclosure,Disclaimer}.tsx`
- Test: `tests/unit/prompt.test.ts`, `tests/integration/result-flow.test.tsx`

**Interfaces:**
- Produces: `generatePrompt(case, variant): PromptSnapshot`，`variant` 为 `concise | professional`。
- Consumes/updates: `caseRepository.put()`；一个回答必须含 `id`、`source`、`promptId`、`content`、`createdAt`。

- [ ] **Step 1: 写提示词测试**

  精简版必须含问题、时间、卦名、动爻和关键排盘；专业版必须额外含原始投币、四柱、六爻全部字段、规则依据以及七条 AI 输出约束；快照保存 `PROMPT_VERSION` 和完整文本。

- [ ] **Step 2: 写结果闭环测试**

  断言首屏卡展示问题、本变关系、六爻与免责声明；生成提示词后显示朱砂色“已问过 AI？粘贴回答”；保存多个来源回答不覆盖；未回答卦例顶部显示提醒。

- [ ] **Step 3: 实现“全选内容”而非剪贴板写入**

  使用只读 textarea 或 Selection API 选中文字，不调用 `navigator.clipboard` 或 `execCommand`；按钮文案明确提示用户使用平台长按菜单复制。

- [ ] **Step 4: 实现截图卡布局**

  主卡限定移动端竖版宽度，长内容拆为连续卡片；使用 CSS 打印/截图友好样式，不实现 Canvas 导出或文件下载。

- [ ] **Step 5: 验证并提交**

  Run: `npm test -- tests/unit/prompt.test.ts tests/integration/result-flow.test.tsx && git add src tests && git commit -m "feat: complete result prompt and AI answer loop"`

---

### Task 9: 卦例时间线、搜索与修改副本

**Files:**
- Create: `src/features/history/{HistoryPage,HistoryCard,SearchBar,CaseDetail}.tsx`
- Test: `tests/integration/history-flow.test.tsx`

**Interfaces:**
- Consumes: `caseRepository.list/search/delete/duplicate`。
- Produces: 状态标签 `仅排盘`、`已生成提示词`、`待粘贴 AI 回答`、`已保存 AI 回答`、`已补充后续验证`。

- [ ] **Step 1: 写历史页测试**

  断言按更新时间倒序、首页只显示最近三条、可搜索问题/标题/卦名/标签、状态标签映射正确、删除需确认、修改完成卦象会复制新版本而不覆盖原记录。

- [ ] **Step 2: 运行测试确认失败并实现**

  Run: `npm test -- tests/integration/history-flow.test.tsx`
  Expected before implementation: FAIL；实现后 PASS。

- [ ] **Step 3: 覆盖只读降级和存储满提示**

  迁移失败记录仍可浏览原始 JSON 摘要但不允许编辑；容量不足时展示清理旧卦例入口，原记录保持可读。

- [ ] **Step 4: 提交**

  Run: `git add src/features/history tests/integration/history-flow.test.tsx && git commit -m "feat: add searchable case timeline"`

---

### Task 10: 移动端端到端验收、文档和发布包

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/cast-and-save.spec.ts`, `manual-and-answer.spec.ts`, `offline.spec.ts`, `mobile-layout.spec.ts`
- Create: `docs/architecture.md`, `docs/algorithm.md`, `docs/privacy.md`, `docs/xhs-review-guide.md`
- Create: `README.md`

**Interfaces:**
- Produces: 可复现的本地开发、测试、打包和小红书上传流程。
- Produces: `dist/`，压缩时以其内容作为包根目录，压缩包本身不提交 Git。

- [ ] **Step 1: 写端到端测试**

  使用小屏手机 viewport 覆盖三分钟内完成模拟摇卦并保存、一分钟内完成手动录入、生成并选中提示词、粘贴两个 AI 回答、刷新后恢复、搜索历史和复制修改版本。

- [ ] **Step 2: 写离线与禁用能力测试**

  Playwright 拦截所有请求，除同源静态资源外一律令测试失败；浏览器上下文离线后重新加载已构建应用，核心起卦、排盘、历史读取仍通过。

- [ ] **Step 3: 写布局和无障碍测试**

  在 320px、375px、430px 宽度与安全区下检查无横向溢出、按钮最小点击区、软键盘后表单可见、减少动态模式、长问题和长 AI 回答；保存关键截图到测试产物而非仓库。

- [ ] **Step 4: 完成项目文档**

  `README.md` 给出 Node 版本、安装、开发、测试、构建命令；`algorithm.md` 标明来源文件、四柱近似边界和固定案例；`privacy.md` 说明数据仅保存在设备容器且不保证永久；`xhs-review-guide.md` 逐项对应上传、CSP、真机检查和审核材料。

- [ ] **Step 5: 运行完整验证**

  Run: `npm ci && npm run lint && npm test && npm run build && npx playwright test`
  Expected: 全部通过；构建扫描报告 0 条违规；离线端到端流程通过。

- [ ] **Step 6: 检查产物内容**

  Run: `node scripts/verify-xhs-build.mjs dist`
  Expected: 输出 `0 violations`；`dist/index.html` 为唯一 HTML 入口，资源引用均为包内相对路径。

- [ ] **Step 7: 提交发布准备**

  Run: `git add README.md docs playwright.config.ts tests/e2e && git commit -m "docs: add XHS release and verification guide"`

---

## 最终验收清单

- [ ] 三种录入方式产出相同 `DivinationCase` 数据链。
- [ ] 64 卦、6/7/8/9、0..6 动爻、纳甲、六亲、六神、世应、旬空与伏神全部有自动化测试。
- [ ] 变卦六亲以本卦卦宫为准的回归测试通过。
- [ ] 现场摇卦中断后可继续，完成卦修改时必须复制版本或二次确认。
- [ ] 提示词可被选中，代码未调用任何剪贴板 API。
- [ ] 一个卦例可保存多个回答，每个回答关联准确的提示词快照。
- [ ] 无网络时起卦、排盘、初判、提示词与历史功能全部可用。
- [ ] 构建产物不含外部 URL、网络 API、内联脚本、Worker、WASM、iframe 或下载行为。
- [ ] 320px 小屏、系统安全区、长文本和减少动态模式通过验收。
- [ ] README、算法说明、隐私说明和小红书审核说明齐全。

## 执行顺序与检查点

任务 1—5 构成“离线内核”检查点：必须先验证完整排盘和存储，再开始大规模 UI。任务 6—9 构成“产品闭环”检查点：每项完成后都能由集成测试证明一条独立用户路径。任务 10 是发布门禁；只有完整测试和构建扫描同时通过时，才生成小红书上传压缩包。
