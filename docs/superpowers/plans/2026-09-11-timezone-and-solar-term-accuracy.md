# 问爻排盘时间基准与节气精度修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让"起卦时间 → 四柱"这条链在规定时区（北京时间 UTC+8）下确定、可复现、可自证：结果页与历史页显示本地时刻而非 UTC 裸字符串；节气按真实交节时刻划分年柱与月柱；提示词自描述时区与排盘规则，使外部 AI 复核得到同一结论；同一绝对时刻在任意宿主时区得到相同四柱。

**Architecture:** 保持 React 19 + TypeScript 6 + Vite 8 + 原生 CSS + 纯函数引擎的既有结构。新增"排盘时区"概念（`CastTimeZone`）并把绝对时刻→本地字段的换算收敛到单一模块 `engines/calendar/zoned-time.ts`；`calculateSizhu` 改为接收（绝对时刻, 时区偏移）而非宿主 `Date` 本地字段；节气交界由"固定公历日期"改为"交节时刻比较"，节气数据按权威来源生成并入库；`DivinationCase` 增加时区字段并提升 `schemaVersion`，旧记录通过迁移补默认值时区且不改写已保存的 `chart` 快照；提示词的文字时间与结构化 JSON 从同一 `DivinationCase` + 同一时区派生。

**Tech Stack:** React 19、TypeScript 6、Vite 8、原生 CSS、Vitest、Testing Library、Playwright、localStorage、IndexedDB、Node（仅用于一次性生成节气数据）。

---

## 1. 问题确认（代码与实测证据）

### 1.1 结果页时间固定早 8 小时

内部以 `toISOString()` 正确保存绝对时刻（北京时间 2026-09-11 20:34 存为 `2026-09-11T12:34:00.000Z`），但展示层直接截断 ISO 字符串前 16 位，等价于按 UTC 墙钟渲染，未做时区换算。三处独立重复实现：

| 位置 | 代码 | 展示对象 |
| --- | --- | --- |
| `src/features/result/HeroCard.tsx:20` | `{caseValue.castAt.slice(0, 16).replace('T', ' ')}` | 结果卡起卦时间 |
| `src/features/history/HistoryPage.tsx:40` | `{value.updatedAt.slice(0, 16).replace('T', ' ')}` | 历史卡更新时间 |
| `src/features/result/AnswerPanel.tsx:73` | `{answer.createdAt.slice(0, 16).replace('T', ' ')}` | AI 回答时间 |

全库没有任何 `Intl.DateTimeFormat` / `toLocaleString` / `toLocaleDateString`，即不存在任何一处做过时区换算。

### 1.2 AI 提示词的时间与四柱表达冲突

`src/engines/prompt/engine.ts:19` 把原始 ISO 直接写入提示词（`起卦时间：${caseValue.castAt}` → `2026-09-11T12:34:00.000Z`），而四柱由 `calculateSizhu` 按**宿主本地字段**算出（北京时间 20:34 → 壬戌时）。外部 AI 若按 `12:34Z` 复核，会得到午时，与提示词给出的戌时矛盾。同一冲突也存在于 `src/engines/prompt/structured.ts:94` 的 JSON 快照。

### 1.3 真实节气被简化成固定日期零点

`src/engines/calendar/calendar.ts:6-19` 的 `JIE_QI` 只有"月、日"，无交节时刻；`yearGanzhi`/`monthGanzhi` 用"日期比较"决定换年换月。与香港天文台公布的 2026 年数据对照，误差不只是"当天零点 vs 具体时刻"，还有**整日偏差**：

| 节气（2026） | 代码固定日期 | 天文台公布（UTC+8） | 偏差 |
| --- | --- | --- | --- |
| 小寒 | 1 月 6 日 00:00 | 1 月 5 日 16:23 | 整日 +1 |
| 立春 | 2 月 4 日 00:00 | 2 月 4 日 04:02 | 缺 4 小时 02 分 |
| 惊蛰 | 3 月 6 日 00:00 | 3 月 5 日 21:59 | 整日 +1 |
| 立夏 | 5 月 6 日 00:00 | 5 月 5 日 | 整日 +1 |
| 芒种 | 6 月 6 日 00:00 | 6 月 5 日 | 整日 +1 |
| 立秋 | 8 月 7 日 00:00 | 8 月 7 日 19:43 | 缺 19 小时 43 分 |
| 白露 | 9 月 8 日 00:00 | 9 月 7 日 22:41 | 整日 +1 |

因此 2026-09-07 23:00 本项目给丙申月，实际应为丁酉月；2026-02-04 02:00 本项目已换年为丙午年庚寅月，实际应仍为乙巳年己丑月。误差沿 `chart.sizhu` 向下传导至月建、月破、旺衰与全部离线规则判断（`src/engines/interpretation/engine.ts:30-31` 消费 `sizhu`）。

### 1.4 排盘结果依赖宿主时区

`src/engines/calendar/calendar.ts` 直接读取宿主本地字段：`:26`（`getFullYear/getMonth/getDate` 塞进 `Date.UTC`）、`:31-32`、`:40-42`、`:48`、`:56`、`:68`（`getHours`）。同一 `2026-09-11T12:34:00.000Z`：

- Asia/Shanghai 宿主 → 壬戌时
- UTC 宿主 → 戊午时

数据模型（`src/domain/types.ts:107-131`）没有任何字段记录排盘采用的时区，事后无法判断一条旧卦例是按哪个时区算出来的，也无法在新设备上复现。

### 1.5 两个入口各自的取时问题

- **现场摇卦**：`src/app/use-case-session.ts:145`（进入"选择摇卦方式"）、`:149`、`:153`（选定方式）都在推进流程时用 `new Date().toISOString()` 覆盖 `castAt`，最终 `completeCast`（`:219`）用这个冻结值排盘。摇卦过程跨过时辰边界（例如 18:59 选方式、19:02 得卦）时，排盘用的是旧时辰；现场流程也没有时间校正入口（`setCastAt` 在 `:180` 存在但无 UI 使用）。
- **手动排盘**：`datetime-local` → `Date` → ISO 的往返在东八区宿主下自洽，但 `SizhuEditor.tsx:13` 的回填同样读宿主本地字段，非东八区宿主会整体偏移；并且 `use-manual-editor.ts:191` 的 `setCastAt` 只改时间、**不清除已有的四柱覆盖**，用户手工改过四柱后再改时间，旧覆盖会静默保留，直到手动点击"使用起卦时间重新计算"（`:200`）——这正是 1.2 同类矛盾的另一种成因。

### 1.6 测试为何没能发现

`TZ=UTC npx vitest run` 与 `TZ=America/New_York npx vitest run` 均为 **215 项全部通过**（本次实测）。原因是测试全部用宿主本地构造器（`new Date(2026, 7, 28, 12, 0)`）再交给只读宿主本地字段的引擎，构造与读取同源，误差自我抵消。全库仅 `tests/unit/manual-model.test.ts:15` 使用了显式 UTC 字面量。E2E 也从未断言任何时间文本，`datetime-local` 输入完全未被端到端覆盖。

---

## 2. Global Constraints

- 运行时零网络、零新增运行时依赖（`package.json` 的 `dependencies` 只有 react / react-dom，节气的生成脚本属开发期工具，不得进运行时包）。
- 继续满足 `scripts/verify-xhs-build.mjs` 的全部约束，构建输出 `0 violations`，ZIP 仍 < 2MB。
- 排盘引擎保持纯函数：不得读宿主时钟、不得读 `getTimezoneOffset`、不得依赖 `Intl`/IANA tz 数据；时区只以显式参数进入。
- 不得改写已保存卦例的 `chart` 快照；旧记录迁移只补元数据。
- 三个入口（模拟铜钱、现实投币、手动排盘）必须收敛到同一个 `buildChart`，不得出现第二条干支推算路径。
- 所有新行为测试先行；每个 Task 完成后运行该 Task 的测试并提交一次。
- 版本策略：算法语义变化 → `ENGINE_VERSION`；数据结构变化 → `SCHEMA_VERSION` + 迁移函数；提示词格式变化 → `PROMPT_VERSION`。

---

## 3. 设计决策

### D1 排盘时区：固定北京时间（UTC+8），记录在卦例上

规定 `Asia/Shanghai`= 固定 `+480` 分钟（现代中国无夏令时），语义标签"北京时间"。理由：本工具面向中文用户、月建旺衰等概念均以北京时间为准；离线容器不具备 IANA tz 数据库，实现全时区支持既不必要也无法验证。

新增 `src/engines/calendar/zoned-time.ts`：

```ts
export interface CastTimeZone {
  id: 'Asia/Shanghai'
  label: '北京时间'
  offsetMinutes: number  // 480
  /** 迁移自 v1 记录、原记录未保存时区时标记，用于界面提示 */
  assumed?: boolean
}

export const CAST_TIME_ZONE: CastTimeZone

export interface ZonedParts {
  year: number; month: number; day: number
  hour: number; minute: number; second: number
}

/** 绝对时刻 → 指定时区的日历字段；实现只使用 getUTC* 读取，禁止宿主本地字段 */
export function toZonedParts(instant: Date | number, offsetMinutes: number): ZonedParts
/** 指定时区的日历字段 → 绝对时刻（ms） */
export function fromZonedParts(parts: ZonedParts, offsetMinutes: number): number
/** 绝对时刻 → 'YYYY-MM-DD HH:mm' */
export function formatZonedDateTime(iso: string, offsetMinutes?: number): string
/** 绝对时刻 → '2026-09-11 20:34（北京时间 UTC+8）' */
export function formatZonedTimestamp(iso: string, zone?: CastTimeZone): string
```

`toZonedParts` 用 `new Date(ms + offsetMinutes * 60_000)` 后仅读 `getUTCFullYear/getUTCMonth/getUTCDate/getUTCHours/getUTCMinutes/getUTCSeconds` 实现——偏移平移后的 UTC 字段即目标时区的本地字段。

### D2 节气：运行时用带世纪修正的通用公式，测试用权威锚点逐项对照

节气交节时刻不引入逐年大表，改用"寿星通用公式 + 世纪/年份修正表"在 `src/engines/calendar/solar-terms.ts` 内计算（1900–2100，目标误差 ≤ 1 分钟），配套：

```ts
export const SOLAR_TERM_RANGE = { fromYear: 1900, toYear: 2100 } as const
/** 节气序号 0..11 对应 小寒、立春、惊蛰、清明、立夏、芒种、小暑、立秋、白露、寒露、立冬、大雪（即十二"节"） */
export function jieInstant(year: number, index: number): number
/** 绝对时刻所属的"节"序号与其交节时刻；越界抛错或返回受检结果 */
export function jieAt(instantMs: number): { index: number; instant: number; year: number }
export function isWithinRange(instantMs: number): boolean
```

若个别年份经对照超出 1 分钟容差，允许在该模块内加**逐年校正条目**（`{ year, index, deltaMinutes }`）并注明来源，不允许静默放过。

选择理由：运行时数据量最小（约 2KB 代码，无大表）、范围可覆盖全部现实输入、精度可用权威公布值逐项验证；相比嵌入 201 年 × 24 项的数据表更易审阅。备选方案（不采用）：直接嵌入天文台逐年时刻表，体积与维护成本更高，且与公式方案的验收方式一致。

**边界规则**：`instant >= 交节时刻` 归新月/新年，严格早于则归上月/上年。判定一律在 UTC+8 下进行，与数据来源时区一致。

**范围约束**：`1900-01-01 00:00`（UTC+8）～ `2100-12-31 23:59`（UTC+8）为支持区间。区间外不静默降级：手动排盘的 `datetime-local` 设 `min`/`max`，引擎抛出可读错误，界面提示"起卦时间超出支持范围（1900–2100）"。下限取 1900 是为了保留既有 `1900-01-01 = 甲戌日` 日柱基准测试。

### D3 起卦时刻：以"得卦时刻"为准，并提供校正入口（**需确认**）

推荐：现场摇卦的正式 `castAt` = **第六爻确定（得卦/生成结果）的时刻**，而非"进入选择摇卦方式"的时刻。

理由：传统以卦成之时取四柱；摇卦可能跨越时辰边界，取完成时刻与"得卦"语义一致；草稿跨天恢复后再完成时不会把旧日期的时辰带入。

同时新增两项：
1. 结果确认（review）步骤显示"起卦时间"并允许手动修正（复用已存在的 `setCastAt`），修正后四柱、旬空、月建随之重算；
2. 记录 `castStartedAt`（开始摇卦时刻）作为诊断信息，不参与排盘。

备选（若确认以"开始摇卦"为准）：保留 `:145/:149/:153` 的冻结语义，但必须处理草稿跨天恢复，并在 review 步骤显著提示"起卦时间为 X，发现不准确请点击修正"。

### D4 提示词自描述：时区、排盘规则与人工校正必须显式声明

提示词同时服务人和外部 AI，因此不再输出裸 UTC 时刻，改为本地时刻 + 时区标注 + 规则声明，并保留机器可读的绝对时刻：

- 精简版与专业版文字行：
  `起卦时间：2026-09-11 20:34（北京时间 UTC+8）`
  `排盘时区：Asia/Shanghai（UTC+8）`
  `排盘规则：节气按天文台公布时刻（UTC+8，±1 分钟）；23:00 起子时不换日柱；未做真太阳时校正`
- 专业版 JSON（`src/engines/prompt/structured.ts`）新增：
  `castAtLocal`、`timeZone: { id, label, offsetMinutes }`、`rules: { solarTermSource, ziHourRule, trueSolarTime }`、`sizhuOverridden: boolean`（四柱是否被人工校正）。
  保留 `castAt` 原始 ISO 作为机器可读的绝对时刻。

这样"外部 AI 按提示词复核"的两种读法（按本地时间 + 规则，或按绝对时刻 + 时区）都会得到同一四柱。

### D5 时间变更与人工覆盖的一致性

- 手动排盘：`setCastAt` 触发四柱与旬空的重算，并**清除**受时间影响的覆盖——`overrides.sizhu`（四柱）与爻级 `xunKong`（旬空依赖日柱）；其余爻级覆盖（`gan`/`zhi`/`liuqin`/`liushen`/`shiYing`/`fushen`）与时间无关，保留。状态区给出提示"起卦时间已更新，四柱与旬空已按新时间重算"，不静默。
- "使用起卦时间重新计算"按钮保留（用于纯手工输入四柱后回到自动值），但其存在不再是"改时间后必须记得点"的前提。
- 若最终提交的 `chart.sizhu` 与按 `castAt` 自动推导值不同（存在人工覆盖），结果页与结构化 JSON 必须标注人工校正（沿用 `overriddenFields` 的表达方式，四柱用 `sizhuOverridden`）。

### D6 明确非目标（写入文档，避免被当作缺陷）

- **真太阳时**（经度时差 + 均时差）：不做。数据模型预留 `longitude`/`trueSolarTime` 字段位置，规则声明中标为 `false`。
- **23:00 子时不换日柱**：保持现状（晚子时不换日柱的简化），但必须在提示词规则声明中写出，使外部 AI 知道采用哪一派。
- **1949 年前中国时区与 1986–1991 夏令时**：统一按固定 UTC+8 处理，文档声明差异。

---

## 4. File Map

### 新建文件

- `src/engines/calendar/zoned-time.ts`：`CastTimeZone`、时区↔绝对时刻换算、展示格式化，全库唯一的时间换算入口。
- `src/engines/calendar/solar-terms.ts`：十二"节"交节时刻计算、所属节气月判定、支持范围校验。
- `tests/fixtures/beijing-time.ts`：`beijing('2026-08-28 12:00')` → 绝对时刻 ISO 的测试帮助函数，替换全部宿主本地构造。
- `tests/fixtures/solar-terms-2026.ts`：2026 年 24 节气权威时刻对照夹具（含来源 URL 与取数日期），供表驱动测试使用。
- `tests/unit/zoned-time.test.ts`：时区换算、跨日/闰年/月末边界、格式化。
- `tests/unit/solar-terms.test.ts`：节气对照、交节前后边界、范围校验。
- `tests/unit/time-zone-invariance.test.ts`：同一绝对时刻在不同 `TZ` 下四柱一致（三入口收敛性）。

### 修改文件

- `src/engines/calendar/calendar.ts`：删除 `JIE_QI` 固定日期表与全部宿主本地字段读取；`yearGanzhi`/`monthGanzhi`/`dayGanzhi`/`hourGanzhi`/`calculateSizhu` 改为接收（绝对时刻, `offsetMinutes`）。
- `src/engines/najia/chart.ts`：`buildChart` 签名携带时区（见 Task 2 Interfaces）。
- `src/domain/types.ts`：`DivinationCase` 增加 `timeZone` 与可选 `castStartedAt`。
- `src/domain/versions.ts`：`SCHEMA_VERSION` 1→2、`ENGINE_VERSION` 0.1.0→0.2.0、`PROMPT_VERSION` 2.0.0→2.1.0。
- `src/domain/validation.ts`：校验 `timeZone`；
- `src/storage/migrations.ts`：新增 v1→v2 迁移步骤（补 `timeZone`，标 `assumed: true`）。
- `src/engines/prompt/engine.ts`、`src/engines/prompt/formatter.ts`、`src/engines/prompt/structured.ts`：时间表达与规则声明。
- `src/features/result/HeroCard.tsx`、`src/features/history/HistoryPage.tsx`、`src/features/result/AnswerPanel.tsx`：改用统一格式化。
- `src/features/manual/SizhuEditor.tsx`、`src/features/manual/use-manual-editor.ts`：输入按排盘时区回填、时间变更清理覆盖。
- `src/app/use-case-session.ts`：得卦时刻取时 + 校正入口。
- `src/features/cast/*`：review 步骤的起卦时间显示与修正。
- `tests/**`：见 Task 内逐条列出。
- `docs/algorithm.md`、`docs/architecture.md`、`docs/implementation-status.md`、`docs/xhs-review-guide.md`。

---

## 5. 实施计划

### Task 1: 时区与时间格式化基础设施 + 展示层修复（问题 1）

**Files:**
- Create: `src/engines/calendar/zoned-time.ts`
- Create: `tests/unit/zoned-time.test.ts`
- Modify: `src/features/result/HeroCard.tsx`、`src/features/history/HistoryPage.tsx`、`src/features/result/AnswerPanel.tsx`

**Interfaces:**

```ts
export const CAST_TIME_ZONE: CastTimeZone           // { id: 'Asia/Shanghai', label: '北京时间', offsetMinutes: 480 }
export function toZonedParts(instant: Date | number, offsetMinutes: number): ZonedParts
export function fromZonedParts(parts: ZonedParts, offsetMinutes: number): number
export function formatZonedDateTime(iso: string, offsetMinutes?: number): string   // '2026-09-11 20:34'
export function formatZonedTimestamp(iso: string, zone?: CastTimeZone): string     // '2026-09-11 20:34（北京时间 UTC+8）'
```

- [ ] **Step 1: Write failing zoned-time tests**

覆盖：`2026-09-11T12:34:00.000Z` → `2026-09-11 20:34`；跨日（`2026-09-11T16:30:00.000Z` → `2026-09-12 00:30`）；闰年 `2028-02-29`；月/年末尾；`fromZonedParts(toZonedParts(x)) === x` 往返；非法输入返回占位而非抛错（界面用）。

- [ ] **Step 2: Verify the tests fail**

- [ ] **Step 3: Implement `zoned-time.ts`**

只允许 `getUTC*`；不得出现 `getFullYear/getHours/getTimezoneOffset`。

- [ ] **Step 4: Replace the three truncation sites**

`HeroCard` 起卦时间、`HistoryPage` 更新时间、`AnswerPanel` 回答时间全部改用 `formatZonedDateTime`；起卦时间与历史卡在首次出现处附"北京时间"标注。历史列表排序仍按 ISO 字符串（绝对时刻，比较语义不变）。

- [ ] **Step 5: Add display assertions**

集成测试新增：固定 `castAt = '2026-09-11T12:34:00.000Z'` 时，结果卡显示 `2026-09-11 20:34`，历史卡与回答时间同理；断言不出现 `12:34`。

- [ ] **Step 6: Run the suite under three host timezones**

`npx vitest run`、`TZ=UTC npx vitest run`、`TZ=America/New_York npx vitest run` 均需通过（既有 215 项不得回退）。

- [ ] **Step 7: Commit Task 1**

### Task 2: 排盘引擎时区化与数据模型迁移（问题 4）

**Files:**
- Modify: `src/engines/calendar/calendar.ts`、`src/engines/najia/chart.ts`、`src/domain/types.ts`、`src/domain/versions.ts`、`src/domain/validation.ts`、`src/storage/migrations.ts`、`src/app/use-case-session.ts`、`src/features/manual/model.ts`、`src/features/manual/use-manual-editor.ts`
- Create: `tests/fixtures/beijing-time.ts`、`tests/unit/time-zone-invariance.test.ts`
- Modify: `tests/unit/calendar.test.ts`、`tests/unit/chart.test.ts`、`tests/unit/interpretation.test.ts`、`tests/unit/prompt.test.ts`、`tests/unit/prompt-structured.test.ts`、`tests/unit/draft-store.test.ts`、`tests/unit/case-db.test.ts`、`tests/unit/migrations.test.ts`、`tests/unit/manual-model.test.ts`、`tests/integration/*.test.tsx`

**Interfaces:**

```ts
// calendar.ts —— 不再接收宿主 Date 语义的“本地时刻”
export function calculateSizhu(instant: Date | number, offsetMinutes: number): Sizhu
export function yearGanzhi(instant: Date | number, offsetMinutes: number): string
export function monthGanzhi(instant: Date | number, offsetMinutes: number): string
export function dayGanzhi(instant: Date | number, offsetMinutes: number): string
export function hourGanzhi(instant: Date | number, offsetMinutes: number): string

// najia/chart.ts —— 时区随起卦信息一起进入，默认取 CAST_TIME_ZONE
export interface BuildChartOptions { timeZone?: CastTimeZone }
export function buildChart(
  rawValues: readonly RawYaoValue[],
  castAt: string | Date,
  overrides?: ChartOverrides,
  options?: BuildChartOptions,
): HexagramChart

// types.ts
export interface DivinationCase {
  // …既有字段
  timeZone?: CastTimeZone      // v2 起必填；迁移件为 { ...CAST_TIME_ZONE, assumed: true }
  castStartedAt?: string       // 开始摇卦时刻，仅诊断
}
```

- [ ] **Step 1: Write failing time-zone-invariance tests**

用显式 ISO 绝对时刻断言：`2026-09-11T12:34:00.000Z` → 丙午年 丁酉月 戊子日 壬戌时；`2026-09-11T16:30:00.000Z` → 日柱按 09-12 计。测试必须在 `TZ=UTC`、`TZ=America/New_York`、`TZ=Asia/Shanghai` 下给出相同结果。

- [ ] **Step 2: Add `beijing()` test helper and replace host-local constructors**

`new Date(2026, 7, 28, 12, 0)` 这类构造全部替换为 `beijing('2026-08-28 12:00')`，使测试与宿主时区解耦。

- [ ] **Step 3: Implement zoned calendar**

删除宿主本地字段读取；年/月/日/时柱全部基于 `toZonedParts`。日柱仍以本地日期（不因 23:00 换日）计算，保持既有约定。

- [ ] **Step 4: Thread the time zone through `buildChart` and the data model**

`DivinationCase.timeZone` 落地；所有构造点（`use-case-session`、`use-manual-editor`、`factories`、`case-db` 的 duplicate）写入 `CAST_TIME_ZONE`。

- [ ] **Step 5: Bump versions and add the v1→v2 migration**

`SCHEMA_VERSION = 2`、`ENGINE_VERSION = '0.2.0'`；`MIGRATIONS[1]` 补 `timeZone: { ...CAST_TIME_ZONE, assumed: true }`，不改动 `chart` 快照。`validation.ts` 要求 v2 记录具备合法 `timeZone`。

- [ ] **Step 6: Re-verify and update affected expectations**

复核 `calendar.test.ts`、`chart.test.ts`、`interpretation.test.ts` 等所有四柱期望值（在 Task 4 精确节气落地后需再复核一次交节相关用例）。旧记录迁移测试断言"快照不变、可读可写"。

- [ ] **Step 7: Run the three-timezone matrix**

- [ ] **Step 8: Commit Task 2**

### Task 3: 提示词时间与时区自描述（问题 2）

**Files:**
- Modify: `src/engines/prompt/engine.ts`、`src/engines/prompt/formatter.ts`、`src/engines/prompt/structured.ts`、`src/domain/versions.ts`
- Modify: `tests/unit/prompt.test.ts`、`tests/unit/prompt-structured.test.ts`

**Interfaces:**

```ts
// formatter.ts
export function formatCastTime(castAt: string, zone: CastTimeZone): string      // '2026-09-11 20:34（北京时间 UTC+8）'
export function formatCastRules(): string[]                                     // 节气来源 / 子时规则 / 真太阳时 三行

// structured.ts（新增字段）
export interface StructuredPromptData {
  // …既有字段
  castAtLocal: string
  timeZone: { id: string; label: string; offsetMinutes: number }
  rules: { solarTermSource: string; ziHourRule: 'no-day-rollover'; trueSolarTime: false }
  sizhuOverridden: boolean
}
```

- [ ] **Step 1: Write failing prompt tests**

断言精简版与专业版均包含 `起卦时间：2026-09-11 20:34（北京时间 UTC+8）`、`排盘时区：Asia/Shanghai（UTC+8）` 与三行规则声明；专业版 JSON 含 `castAtLocal`/`timeZone`/`rules`/`sizhuOverridden`；断言提示词文本中**不存在**未标注时区的裸 `…Z` 时刻。

- [ ] **Step 2: Verify the tests fail**

- [ ] **Step 3: Implement the prompt changes**

- [ ] **Step 4: Add the round-trip invariant test**

从提示词文字行反解析"本地时间 + 时区"→ 绝对时刻，必须等于 `case.castAt`（防止文字时间与 JSON 各自漂移）。

- [ ] **Step 5: Bump `PROMPT_VERSION` to 2.1.0 and run prompt tests**

- [ ] **Step 6: Commit Task 3**

### Task 4: 精确节气与支持范围（问题 3）

**Files:**
- Create: `src/engines/calendar/solar-terms.ts`、`tests/fixtures/solar-terms-2026.ts`、`tests/unit/solar-terms.test.ts`
- Modify: `src/engines/calendar/calendar.ts`、`src/features/manual/SizhuEditor.tsx`、`src/domain/versions.ts`
- Modify: `tests/unit/calendar.test.ts`、`tests/unit/chart.test.ts`（交节相关期望）

- [ ] **Step 1: Fill the 2026 fixture from the authoritative source**

用香港天文台「二十四節氣的日期及時間資料」（香港時間 UTC+8，与北京时间一致）补齐 2026 全年 24 项分钟值，夹具文件注明来源 URL 与取数日期。已知锚点（本次核查确认）：小寒 1/5 16:23、大寒 1/20 09:44、立春 2/4 04:02、雨水 2/18 23:51、惊蛰 3/5 21:59、春分 3/20 22:45、立秋 8/7 19:43、白露 9/7 22:41。

- [ ] **Step 2: Write failing solar-term tests**

表驱动对照 2026 全部 24 项（容差 ≤ 1 分钟）；交节前后各 1 分钟的年柱/月柱断言；范围外输入报错；`1900-01-01` 日柱基准仍成立。

- [ ] **Step 3: Implement `solar-terms.ts` and remove the fixed-date table**

`yearGanzhi` 以立春交节时刻为界，`monthGanzhi` 以十二"节"交节时刻为界，全部在 UTC+8 下按时刻比较。

- [ ] **Step 4: Bound the input range**

`datetime-local` 设 `min="1900-01-01T00:00"`/`max="2100-12-31T23:59"`；越界给可读错误与界面提示；引擎层同样拒绝。

- [ ] **Step 5: Add the six whole-day regressions**

对 2026 年小寒、惊蛰、立夏、芒种、白露、立春，断言修正前后差异点：被固定日期表误判的时刻现在归正确月份（例如 2026-09-07 23:00 → 丁酉月而非丙申月）。

- [ ] **Step 6: Re-verify interpretation rules at a boundary**

在交节前后各取一个时刻，断言月建/月破/旺衰类规则输出随之改变（证明误差不再向下传导）。

- [ ] **Step 7: Run the full suite under three host timezones**

- [ ] **Step 8: Commit Task 4**

### Task 5: 取时语义与人工覆盖一致性（问题 4 入口 + D3/D5）

**Files:**
- Modify: `src/app/use-case-session.ts`、`src/features/cast/*`、`src/features/manual/use-manual-editor.ts`、`src/features/manual/SizhuEditor.tsx`
- Modify: `tests/integration/cast-flow.test.tsx`、`tests/integration/manual-flow.test.tsx`、`tests/integration/result-flow.test.tsx`
- Modify: `tests/e2e/cast-and-save.spec.ts`、`tests/e2e/manual-and-answer.spec.ts`、`tests/e2e/navigation-and-manual.spec.ts`

- [ ] **Step 1: Write failing cast-time tests**

得卦时刻语义：进入方式选择后跨过时辰边界再完成摇卦，排盘使用完成时刻的时辰；草稿跨天恢复后再完成，使用新的完成时刻。**先与用户确认 D3 的取向再落此步**（若确认以"开始摇卦"为准，则改为断言开始时刻 + 显著提示）。

- [ ] **Step 2: Write failing cast-time-correction tests**

review 步骤可显示并修改起卦时间；修改后四柱、旬空同步变化。

- [ ] **Step 3: Write failing manual-override tests**

改时间后 `overrides.sizhu` 与爻级 `xunKong` 被清除并重算，其余爻级覆盖保留；状态区出现"已按新时间重算"提示；`sizhuOverridden` 在结构化 JSON 中正确反映。

- [ ] **Step 4: Implement the session and manual-editor changes**

- [ ] **Step 5: Add E2E coverage**

E2E 新增：结果页显示北京时间文本；改时间后四柱变化；`datetime-local` 在 320px 下可操作。

- [ ] **Step 6: Run integration and E2E suites**

- [ ] **Step 7: Commit Task 5**

### Task 6: 文档、版本与发布验证

**Files:**
- Modify: `docs/algorithm.md`、`docs/architecture.md`、`docs/implementation-status.md`、`docs/xhs-review-guide.md`

- [ ] **Step 1: Update `docs/algorithm.md`**

四柱规则改为"时区固定 UTC+8 + 交节时刻分界"；删除"节气日期为固定公历近似"条目，替换为节气来源、精度（≤1 分钟）、支持范围（1900–2100）与三项非目标（真太阳时、23:00 不换日、历史时区/夏令时）；更新固定案例为绝对时刻 + 北京时间双重标注。

- [ ] **Step 2: Update `docs/architecture.md`**

`calendar/` 描述去掉"节气近似实现"；版本表同步实际值（当前文档记 `promptVersion 1.0.0`，代码实为 `2.0.0`，属既有文档漂移，一并修正）；补充"排盘时区"说明与 `timeZone` 字段。

- [ ] **Step 3: Update `docs/xhs-review-guide.md`**

合规自检新增：构建产物无新增能力、ZIP 体积记录；真机清单新增两项——设备时区改为 UTC/其他时区后同一时刻四柱与显示不变；1900–2100 范围外输入有明确提示。同步示例版本号。

- [ ] **Step 4: Update `docs/implementation-status.md`**

记录本次四项修复、三个版本号变化与三时区测试矩阵。

- [ ] **Step 5: Repackage and verify**

`npm ci && npm run lint && npm test && npm run build && npm run test:e2e`，再用发布脚本重新打包，核对 `release-summary.md`（`0 violations`、ZIP < 2MB、逐文件哈希）。

- [ ] **Step 6: Commit Task 6**

---

## 6. 验收方案

### A. 自动化门禁（必须全绿）

1. `npm test` 在三组宿主时区下均通过：默认（Asia/Shanghai）、`TZ=UTC`、`TZ=America/New_York`。三组结果必须**完全相同**，包括新增的时区不变性用例。
2. `npm run test:e2e` 通过；新增一个 `timezoneId: 'UTC'` 的 Playwright project，在同一流程下断言结果页/历史页/回答时间显示北京时间且四柱与默认时区一致。
3. `npm run build` 内嵌的 `verify-xhs-build.mjs` 输出 `0 violations`；ZIP < 2MB；记录节气实现带来的体积增量（预算：原始 JS 增量 ≤ 150KB，gzip ≤ 40KB；实际预计远低于此）。

### B. 数据正确性对照（可人工复核）

4. 2026 年 24 节气表驱动测试逐项对照香港天文台公布值，容差 ≤ 1 分钟；夹具注明来源 URL 与取数日期。
5. 六个"固定表整日偏错"回归：小寒 1/5、立春 2/4（含 04:02 时刻）、惊蛰 3/5、立夏 5/5、芒种 6/5、白露 9/7——断言被旧表误判的具体时刻现在归入正确年月。
6. 交节前后各 1 分钟边界断言：立春、惊蛰、立秋、白露，覆盖年柱与月柱。
7. 越界输入：`1899-12-31`、`2101-01-01` 给出明确错误而非静默降级。

### C. 用户可见验收（对应问题诊断表）

8. 两条入口（现场摇卦、手动排盘）使用同一时刻 `2026-09-11T12:34:00.000Z`：结果卡与历史卡显示 `2026-09-11 20:34`，不再显示 `12:34`。
9. 提示词（精简版与专业版）出现 `起卦时间：2026-09-11 20:34（北京时间 UTC+8）` 与排盘规则声明；专业版 JSON 含 `castAtLocal`/`timeZone`/`rules`/`sizhuOverridden`；不再出现未标注时区的裸时刻。
10. 把设备/容器时区改成 UTC 或其它时区后，同一时刻的四柱与全部时间显示不变（Playwright 时区上下文 + 真机各验一次）。
11. 手动排盘改时间后，四柱与旬空按新时间重算并有明确提示，不再需要用户记得点"使用起卦时间重新计算"。

### D. 不变量测试（防回归）

12. **时间往返**：提示词文字时间 + 时区 → 绝对时刻 == `case.castAt`。
13. **推导一致**：`chart.sizhu` == `calculateSizhu(case.castAt, case.timeZone.offsetMinutes)`，除非四柱存在人工覆盖，且此时结构化 JSON 的 `sizhuOverridden` 为 `true`。
14. **三入口收敛**：相同 `(rawValues, castAt, timeZone)` 经模拟摇卦、现实投币、手动排盘三条路径产生相同四柱与相同 `chart`。
15. **无宿主时区依赖**：`src/engines/**` 全文不得出现 `getFullYear|getMonth|getDate|getHours|getMinutes|getTimezoneOffset`（用 ESLint 规则或单元测试扫描源文件强制）。

### E. 兼容与回归

16. v1 旧卦例：迁移后仍可读可写，`chart` 快照逐字节不变，`timeZone` 标记为 `assumed: true` 并在界面提示"旧版记录未保存时区，按北京时间显示"。
17. 既有 215 项测试的期望值变更必须逐条列在提交说明中，且仅限节气边界、立春与时间构造方式相关用例；其余断言不得改动。
18. 真机清单（`docs/xhs-review-guide.md` §4）逐项通过，包含新增的时区与范围两项。

---

## 7. 风险与回滚

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 节气公式在个别年份超 1 分钟容差 | 交节边界附近月柱判错 | 允许加逐年校正条目并注明来源；对照测试失败即视为未通过 |
| 三处展示改造遗漏 | 仍显示 UTC 时间 | 以"断言不出现 12:34"的反向断言 + 全库检索 `slice(0, 16)` 兜底 |
| 迁移影响既有用户数据 | 旧卦例不可读 | 迁移只补元数据、不动快照；`migrations.test.ts` 覆盖"快照不变" |
| 时区固定 UTC+8 与用户本地时钟不一致引发困惑 | 用户质疑时间不对 | 所有时间首次出现处标注"北京时间"；非 +8 时区设备在结果页给一次性说明 |
| 范围限制影响极端回填需求 | 用户无法录入 1899 年 | 明确错误提示 + 文档说明；后续如需扩展只需扩表/扩公式范围 |

回滚：改动集中在 `engines/calendar/`、展示层与提示词层，`ENGINE_VERSION` 提升后可整体回退到 0.1.0；节气数据/校正在独立模块内，可单独替换而不动调用方。

---

## 8. 待确认决策

| # | 决策 | 推荐 | 备选 |
| --- | --- | --- | --- |
| D3 | 现场摇卦的起卦时刻 | **得卦时刻（第六爻确定）**，并在 review 步骤提供校正入口 | 开始摇卦时刻（需处理草稿跨天恢复 + 显著提示） |
| — | 展示时区 | **一律北京时间并标注** | 跟随设备本地时间（需同时标注，且与四柱口径不同） |
| — | 节气实现 | **运行时公式 + 权威锚点对照** | 嵌入 1900–2100 逐年时刻表（体积更大，验收方式相同） |
| — | 23:00 换日与真太阳时 | **保持现状并写入提示词规则声明** | 增加"晚子时换日柱"开关（范围扩大，建议另立计划） |
