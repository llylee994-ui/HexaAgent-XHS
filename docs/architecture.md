# 架构说明

## 模块边界

```text
UI 层（features / components / app）
  │  只通过显式类型与引擎通信，不实现任何占卜算法
  ▼
应用服务（app/use-case-session、storage）
  │  会话状态机 + 持久化，只写 rawValues 并调用同一个 buildChart
  ▼
引擎层（engines/*，纯函数、无副作用、无 UI、无运行环境依赖）
  ├── divination/    铜钱换算（faces → 6/7/8/9）
  ├── hexagram/      八卦、64 卦八宫表、本卦/动爻/变卦
  ├── calendar/      四柱、旬空、排盘时区与节气界分（北京时间 + 交节时刻）
  ├── najia/         纳甲、六亲、六神、世应、伏神、排盘管线
  ├── interpretation/ 可解释规则初判（ruleId 可回溯）
  └── prompt/        精简/专业提示词
```

存储层不重新解释排盘数据；引擎层不感知存储与 UI。

## 数据流

所有录入方式（模拟铜钱、现实投币、手动排盘）最终收敛为同一条链：

```text
原始爻值 rawValues[0..5]（索引 0 = 初爻）
  → buildChart(rawValues, castAt, overrides?, { timeZone })  唯一正式排盘入口
  → DivinationCase（含 chart、observations、prompts、answers、timeZone）
  → IndexedDB 持久化（完整快照 + 三级版本号）
```

- `castAt` 保存绝对时刻；`timeZone` 记录该次排盘采用的时区，四柱与全部时间显示都以它解释。
- 摇卦过程中每次变化自动写入 localStorage 活动草稿；完成即清理。
- 手动编辑草稿（`wenyao:manual-editor-draft:v1`）带 `completed` 标记，恢复规则见下节「手动排盘草稿的生命周期」。
- 结果页的每次保存（提示词/回答/卦例信息）通过 `onChange` 交回 App，同步写入 IndexedDB。
- 修改完成卦象只能复制新版本（`parentCaseId` 关联），不覆盖原记录。

## 手动排盘草稿的生命周期

手动排盘草稿并存两个用途：记住未写完的录入（规格 11），以及从结果页返回时恢复以便继续校正（规格 3.1）。为了让"完成后再进入"能开始全新一轮，恢复与否按进入方式与 `completed` 标记共同判定：

| 进入方式（导航栈 `direction`） | 草稿状态 | 行为 |
| --- | --- | --- |
| `back`（从结果页返回上一层） | 任意 | 恢复草稿 |
| `forward`（从首页重新进入） | 未完成 | 恢复草稿，不静默丢弃 |
| `forward`（从首页重新进入） | 已完成 | 起全新一轮，并清除已完结的草稿 |

`complete()` 成功后把草稿标记 `completed` 但仍保留，因此从结果页返回仍能拿到它；草稿文件只在"已完成且从首页重新进入"这一种组合下被清除，此时该轮已经作为正式卦例存进 IndexedDB。判定复用导航栈已有的 `direction`，不新增导航状态。

## 恢复草稿提示与固定操作栏

现场摇卦与手动排盘共用同一套"恢复提示 + 底部固定操作栏"结构，但两者各有独立的草稿存储与恢复判定，互不影响。

- `PageActionBar` 只是页面级的固定操作容器：渲染一个可选的次操作、一个主操作和一行提示，不读写草稿、不决定能否提交。它通过 portal 挂到 `document.body`，因为页面过渡动画会在 `.page-frame__body` 上保留 `transform: translateX(0)`，带 transform 的祖先会成为 `position: fixed` 的包含块，固定栏就会跟着内容滚动；挂到 body 才真正相对视口固定。页面流里保留的 `.page-action-bar__spacer` 用 `calc(96px + var(--safe-bottom))` 补上被固定栏盖住的高度。
- `DraftRecoveryNotice` 只负责那句固定文案与语义（`role="status"`）。是否显示由页面根据 hook 暴露的 `wasRestored` 决定，文案不参与业务判断。
- 草稿的清理与恢复元数据由两个 hook 各自负责，页面只做确认框与按钮编排：
  - `useCaseSession` 的 `wasRestored` 表示本次挂载是否从 localStorage 活动草稿恢复；`discardDraft()` 清草稿、换新 case ID、回到全新问题页，且不产生正式卦例（与 `completeCast()` 有本质区别）。
  - `useManualEditor` 的 `wasRestored` 只在快照 `completed === false` 时为真。已完成的一轮即使恢复（从结果页返回继续校正），也只是校正会话，不显示"上次未完成"的提示。
- 主操作在每种页面状态下只有一个实例：现场摇卦的 `摇动铜钱` / `确认本轮` / `生成结果`，手动排盘的 `生成正式结果`，都只出现在底部固定栏，原来的内容位置不再保留同名按钮。"撤销上一爻""修改卦象""保存草稿""恢复全部自动值"仍留在原内容位置。
- 固定栏的提示取自**真实的保存结果**：两个 hook 各自暴露 `draftSaveFailed`（最近一次写 localStorage 是否失败）。成功显示"当前内容已自动保存"，失败显示"草稿未保存，请勿退出"（并加警示色）。保存失败不阻断流程，但绝不能让用户误以为已经存上而直接退出。
- 固定栏的 `z-index` 低于确认对话框（`1000`），因此确认框始终显示在固定栏之上；底部内边距同时叠加 `--safe-bottom`，占位块随安全区一起增长。

## 排盘时区

- 唯一排盘时区是**北京时间（UTC+8）**，定义在 `src/domain/time-zone.ts`（`CAST_TIME_ZONE`）。
- 绝对时刻 ↔ 时区日历字段的换算集中在 `src/engines/calendar/zoned-time.ts`，是引擎里唯一的时间换算入口。
- 引擎不得读取宿主本地字段；`tests/unit/time-zone-invariance.test.ts` 会扫描 `src/engines` 源码强制这一点。
- 手动排盘的 `datetime-local` 输入按北京时间解释与回填，不跟随设备时区。
- 迁移自 v1 的旧记录没有保存时区，迁移时补默认值并标记 `timeZone.assumed = true`，界面按北京时间显示；其 `chart` 快照保持原样，不重算。

## 版本策略

| 字段 | 当前值 | 说明 |
| --- | --- | --- |
| `schemaVersion` | 3 | 数据结构版本，迁移表按版本逐级升级（v1 → v2 补 `timeZone`；v2 → v3 扩展人物关系类别，不改旧快照） |
| `engineVersion` | 0.2.1 | 排盘内核版本（0.2.1 起支持子女／父母／兄弟人物关系类别的候选用神映射） |
| `promptVersion` | 2.2.0 | 提示词模板版本（2.2.0 起把“用神”收紧为“主用神候选”，并输出人物关系类别说明） |

保存完整快照保证未来升级后旧卦例仍呈现当时结果。迁移失败或来自更新版本的数据以只读展示（`caseRepository.listEntries()` 返回 `readonly` 条目）。

人物关系类别以问卦人为参照：子女／晚辈、父母／长辈、兄弟姐妹／同辈分别给出子孙、父母、兄弟作为主用神候选。复合问题不由离线引擎自动推断辅助六亲，完整问题原文与类别说明会进入提示词，由外部 AI 结合具体事项继续确认。

## 主题与配色

- 全部颜色收敛为 `src/styles/tokens.css` 里的令牌，组件层（`src/features`、`src/components`）不写颜色。深浅两套共用同一组语义名，`src/styles/theme.ts` 把解析后的主题写到 `<html data-theme>`，因此 CSS 里不需要 `prefers-color-scheme` 分支，令牌只有一份定义。
- 偏好存 localStorage 的 `wenyao:theme`。未写入时跟随系统 `prefers-color-scheme` 并响应其变化；用户切换过一次后不再跟随系统。
- 产物禁止内联脚本，所以主题只能在入口脚本里应用（`src/main.tsx` 调用 `initTheme`）。这与 CSS 随入口打包注入的时序一致，不引入额外的首屏闪烁。
- `color-scheme` 随主题切换，原生控件的弹层（手动排盘的下拉、`datetime-local` 日期选择器、滚动条）才会跟着渲染成深色。
- 深色下有三个语义令牌方向取反，改配色时不要照抄浅色值：`--paper-deep` 要比底色更亮（hover 是抬起而非下沉）、`--cinnabar-dark` 要比 `--cinnabar` 更亮（它是"浅底上的深朱砂文字"，深色下语义反转）、`--cinnabar-solid` 保持深朱砂不动（填充按钮与铜钱面配白字，跟着提亮会掉到 3:1 以下）。
- 深色令牌的对比度按 WCAG AA 校验过：正文、次要文字、四个强调色与白字实心按钮对各自底色均 ≥ 4.5:1。

## 离线与沙箱约束

- 运行时禁止：fetch/XHR/WebSocket/WebRTC、内联脚本、`eval`/`new Function`、Worker/Service Worker、WASM、iframe、下载、外链。
- 构建扫描器 `scripts/verify-xhs-build.mjs` 对 `dist/` 全量扫描上述能力，`npm run build` 内嵌执行。
- E2E `offline.spec.ts` 验证：零外部请求 + 缓存重载后核心流程可用。

## 容器兼容（不能依赖的运行时能力）

容器 WebView 不保证处于安全上下文，也不保证有现代 API 与 storage / history 权限。以下约束来自一次被驳回的提审，逐项都实测复现过，改动前请先用等价的环境模拟核对：

- **不用 `crypto.randomUUID`**：它只在安全上下文（https / localhost）可用。标识一律走 `src/domain/ids.ts` 的 `createId()`，它用 `crypto.getRandomValues` 并在 `crypto` 整体缺失时退回 `Math.random`。
- **不用 `structuredClone`、`Array.prototype.at` 等较新 API**：前者在老 WebView 缺失会让「修改为副本」点了没反应，后者会让结果页直接渲染失败。深拷贝纯 JSON 数据用 `JSON.parse(JSON.stringify())`。
- **存储与 history 都可能被拒绝**：读取 `localStorage` 这个属性本身就可能抛 `SecurityError`，`history.pushState` / `back` / `replaceState` 在沙箱 iframe 里会抛。所有访问点必须包 try/catch 并降级——草稿保存失败即忽略；history 不可用则退化为纯内存导航，**且此后不能再调 `history.back()`**，否则会把容器页面真的退出去；IndexedDB 不可用时由 `createCaseRepository` 返回降级仓库，让页面显示提示，而不是在模块求值阶段抛错。
- **入口脚本（`main.tsx` 里的 `initTheme`）不得抛异常**：它在 `createRoot` 之前执行，抛错就是整页白屏。可选能力（跟随系统主题）一律特性检测加 try/catch。
- **顶层必须有 `ErrorBoundary`**：没有它，任何渲染期或 effect 期异常都会让 React 卸载整棵树，容器里表现为整页空白，审核会直接判定功能缺陷。注意它接不住事件处理函数里的异常，那些由各自的 try/catch 负责。

## 专业覆盖

`buildChart` 的 `overrides` 参数支持覆盖四柱与逐爻字段（干支、六亲、六神、世应、旬空），覆盖发生在引擎计算之后，被覆盖的字段记入 `overriddenFields`；覆盖地支时五行、六亲与旬空随之重算。
