# 实施计划完成情况记录

> 对照文档：`docs/superpowers/plans/2026-08-27-xiaohongshu-hexa-tool-implementation.md`
> 记录日期：2026-08-30 · 结论：**Task 1–10 全部完成；经典文本参考增量亦已完成。最终验收清单 9 项通过、1 项基本通过**（详见文末）。

## 2026-11-11 发布 0.3.6

按用户要求提交推送并打包当前已验收的工作区。包版本由 0.3.5 升至 0.3.6；schema 3、engine 0.2.1、prompt 2.2.0 不变。本次提交一并收录工作区已有的主题、容器降级、反馈及记录操作修正，原型与浏览器调试记录保留本地，不进入生产入口。

- 发布门禁重新执行：`npm run lint` 0 问题；`npm test` 37 个文件、367 项通过；`npm run build` 通过且扫描 `0 violations`；生产预览上的 `npm run test:e2e` 28 项通过。
- 发布包：`release/wenyao-xhs-0.3.6.zip`，136,846 字节；SHA-256：`b31a7fa191ba1007b1d47ffe50c3f54d0c59544aa9f481f0ff4c02c32db982e6`。
- 构建主文件：`assets/index-D0hnBmLH.js`。发布摘要位于 `release/release-summary.md`；旧摘要归档为 `release/release-summary-0.3.5.md`，旧 ZIP 原样保留。
- 当前已打包，尚未上传小红书；真机软键盘与平台容器检查仍按 `docs/xhs-review-guide.md` 执行。

## 2026-11-10 恢复草稿提示与固定操作栏（A 方案）

对照计划：`docs/superpowers/plans/2026-11-10-restored-draft-fixed-actions.md`。只改现场摇卦与手动排盘两页；结果页、卦例记录页未动。

| 项目 | 实施结果 |
| --- | --- |
| 现场摇卦恢复 | `useCaseSession` 新增 `wasRestored` 与 `discardDraft()`：从活动草稿恢复时顶部显示固定提示"已恢复上次未完成的卦，可以选择继续完成，也可以开始新一卦。"；六爻齐备的草稿恢复到结果确认阶段（`review`）。清空会同时删除 localStorage 草稿、换新 case ID、重置页面状态，且不生成正式卦例 |
| 手动排盘恢复 | `useManualEditor` 新增 `wasRestored`，仅未完成（`completed === false`）的快照为真；从结果页返回的已完成一轮仍恢复用于校正，但不显示"上次未完成"提示。`discardDraft()` 同步复位该标记，且只清 `manualDraftStore`，不影响现场摇卦草稿 |
| 固定操作栏与唯一主按钮 | 新增共享 `PageActionBar` / `DraftRecoveryNotice`。固定栏 portal 到 `body`（页面过渡动画会保留 `transform`，否则 fixed 会跟着滚动），带 `--safe-bottom` 内边距与等高占位块。原内容位置的"生成结果／生成正式结果"已删除，全页只剩固定栏一个实例；进行中始终保留"摇动铜钱／确认本轮"，六爻完成后切换为"生成结果" |
| 现场摇卦状态上移 | `CoinStage` 与 `PhysicalCoinStage` 改为纯展示（后者只负责正反面切换），本轮铜钱面状态上移到 `CastPage`，避免为固定栏复制一套按钮逻辑 |
| 保存状态提示（验收修正） | 固定栏提示不再写死"当前内容已自动保存"：两个 hook 各自暴露 `draftSaveFailed`（最近一次写 localStorage 的真实结果），成功才显示"当前内容已自动保存"，失败显示"草稿未保存，请勿退出"并加警示色；保存失败仍不阻断流程。存储被禁用的失败场景各有 1 条集成用例锁定 |
| 卦名搜索强化 | 手动排盘面板与顺序未动，只把标签改为"搜索并选择卦名"、placeholder 改为"输入卦名，如：乾、风山渐"，并加大加粗输入框；`aria-label="搜索卦名"` 与搜索逻辑不变 |
| 空页面行为 | 全新空白问题页不显示"开始新一卦"；确认框标题"开始新一卦？"、正文"当前未完成的内容会被清空，且无法恢复。"、确认"清空并重新开始"、取消"继续当前卦"均按确认文案落地 |
| 版本与范围 | 未改版本号、数据 schema、排盘算法、提示词版本；`prototypes/sticky-action-bar/index.html` 未导入、未接入构建、未删除 |
| 自动化门禁 | `npm run lint` 0 问题；`npm test` 37 个测试文件、367 项通过（相对上一版 349 项新增 18 项：共享组件 2、现场会话 4、现场摇卦流程 5、手动流程 6、导航 1）；`npm run build` 通过且 `verify:xhs` 扫描 `0 violations`（产物 `assets/index-D0hnBmLH.js`，398.48 kB / gzip 136.34 kB）；`npm run test:e2e` 28 项通过（新增固定栏定位 2 项 + 安全区 1 项） |
| 发布包 | 开发验收时未打包；2026-11-11 已按用户要求发布为 0.3.6，见上节 |

说明：本任务改动叠加在既有的未提交修改之上（人物关系类别、错误边界、主题等），因此没有按计划的检查点自动提交；工作区保持未提交状态。

## 2026-11-04 人物关系类别扩展

对照设计：`docs/superpowers/specs/2026-11-04-relative-person-categories-design.md`；实施计划：`docs/superpowers/plans/2026-11-04-relative-person-categories-implementation.md`。

| 项目 | 实施结果 |
| --- | --- |
| 类别 | 现场摇卦与手动排盘共用同一选项源，新增“子女／晚辈”“父母／长辈”“兄弟姐妹／同辈”，稳定值为 `children` / `parents` / `siblings`；关系均以问卦人为参照 |
| 候选用神 | 三类分别映射子孙、父母、兄弟；离线规则已覆盖用神出现、伏藏和多现。复合健康／法律／财务问题保留统一专业意见提醒，不自动推断辅助六亲 |
| 提示词 | 精简版与专业版统一使用“主用神候选”；专业版继续输出复合事项说明，结构化 JSON 保留稳定英文 category |
| 数据兼容 | `schemaVersion` 2 → 3、`engineVersion` 0.2.0 → 0.2.1、`promptVersion` 2.1.1 → 2.2.0。v2 → v3 迁移只改 schema 号；v1 仍逐级迁移。旧类别、排盘快照和既有提示词快照不重算、不改写 |
| 持久化 | 活动草稿、手动排盘草稿、IndexedDB 卦例与文本备份均可原样往返三个新类别，备份格式版本不变 |
| 自动化门禁 | `npm run lint` 通过；默认、UTC、America/New_York 三组均为 35 个测试文件、349 项测试通过；TypeScript + Vite 普通构建通过；Playwright 25 项通过（含新增现场摇卦与手动排盘 2 项） |
| 发布包 | 包版本升至 0.3.5；已生成 `release/wenyao-xhs-0.3.5.zip`（134,157 字节，SHA-256 `fbbc4d56d01f65e7e02879dfa8c57cc61c8754aa35832298c4a2d5d980652b1b`），构建扫描为 `0 violations`。0.3.4 ZIP 原样保留，摘要归档为 `release-summary-0.3.4.md`；按要求不再额外验证平台上传格式 |

## 2026-10-01 容器环境兼容加固、反馈补全与 AI 回答的修改/删除（0.3.4）

触发原因：0.3.3 提交小红书被驳回，理由只写了"小工具功能缺陷，可能是页面按钮无法点击，重点排查页面功能完整性"。驳回截图里平台显示 **V1.0.6**，而本工具此前已上传过 6 次（0.1.0 / 0.2.0 / 0.3.0 / 0.3.1 / 0.3.2 / 0.3.3），因此 V1.0.6 对应的是 0.3.3 那次上传，且页面显示"1485 人使用"，说明更早的版本是过审的——问题出在 0.3.3（批量删除那版）之后的新代码或那版引入的行为上。

排查方法与结论：正常浏览器里功能是完整的（375px/320px 两档逐页 × 每个可见控件做命中测试，168 个快照无遮挡、无异常禁用；e2e 全流程通过），因此把重点放在两件事上——**受限容器里会缺失的运行时能力**，以及**点了没有任何可见反馈的按钮**（这正是"看起来点不动"的最直接来源）。前者用"逐一禁用某 API 后跑完整 15 步流程"复现出 7 类确定性故障，后者逐页找到了 3 处。

| 故障（修复前实测现象） | 根因 | 修复 |
| --- | --- | --- |
| 首页正常，点「现场摇卦」「手动排盘」**毫无反应**（`crypto.randomUUID is not a function`） | `crypto.randomUUID` 只在安全上下文可用，容器用 `http://` 或自定义 scheme 打开时不存在；6 处直接调用 | 新增 `src/domain/ids.ts` 的 `createId()`：用不受安全上下文限制的 `crypto.getRandomValues` 拼 UUID v4，`crypto` 整体缺失时退回 `Math.random`；替换 `factories`、`use-case-session`、`prompt/engine`、`case-db`、`AnswerPanel`、`use-manual-editor` 全部调用点 |
| 点「生成结果」后结果页**不出现**（`e.prompts.at is not a function`） | `ResultPage` 用了 `prompts.at(-1)` | 改为下标访问 |
| **首页就白屏**（`IndexedDB 不可用`） | `createCaseRepository` 在缺少 indexedDB 时抛错，而 `App.tsx` 与 `HomePage.tsx` 都在模块求值阶段创建仓库 | 存储不可用时改为返回"降级仓库"（每次调用返回错误），由页面既有错误分支显示提示 |
| 点「下一步」后**整棵树被卸载**（`#root` 子节点数实测变 0） | 草稿保存写在 effect 里且未捕获，`draft-store` 会重新抛出 | `use-case-session` 的草稿保存包 try/catch（草稿是尽力而为的便利功能） |
| 点「手动排盘」后进入错误页 | `manual-draft-store` 的 `globalThis.localStorage` 属性访问本身就会抛 | 访问处包 try/catch，读取失败返回 null |
| **首页就白屏**（`matchMedia(...).addEventListener is not a function`） | `initTheme` 在入口脚本里直接调用 `addEventListener` | 加特性检测（回退 `addListener`）与 try/catch |
| 所有导航按钮失效；且「返回」会把容器里的页面真的退出去 | `useNavigationStack` 的 `pushState`/`back`/`replaceState` 全部无保护 | 三处包 try/catch；`pushState` 失败后记下 `historyUsable`，此后不再调 `history.back()`（浏览器历史里没有我们压入的记录），退化为纯内存导航 |
| 点「修改为副本」毫无反应 | `structuredClone` 在老 WebView 缺失 | 改用 JSON 深拷贝 |
| —（新增兜底） | 上述任一未预料的异常都会让 React 卸载整棵树 | 新增顶层 `ErrorBoundary`（`main.tsx` 包裹 `App`），渲染期与 effect 期异常显示"页面遇到异常 + 重试"而不是空白 |

| 反馈补全（原本点了看不出发生什么） | 修复 |
| --- | --- |
| 「全选内容」只把 textarea 文本选中，移动端没有可见变化，最像"按钮坏了" | 点击后按钮变 `is-success` 且文案变「已全选」，下方提示同步改为"已选中全部文本，请使用平台长按菜单复制"；换提示词后复位 |
| 「保存卦例信息」成功后界面毫无变化 | 成功后按钮切换为成功态并显示"已保存到本机，历史记录里可以随时打开。"；改动任一字段即撤下，避免显示过期状态 |
| 保存失败（存储被禁 / 空间不足）只写控制台，用户以为存上了 | `App` 统一收口所有落盘：失败时在底部显示固定提示（含原因），成功后再清除。提示设 `pointer-events: none`，实测不遮挡任何按钮的点击 |
| 历史页在没有可删记录时留一个禁用的「管理」灰按钮 | 无可删记录时直接不渲染该按钮；进入选择模式后主按钮仍带条数（「删除选中（0 条）」）自解释 |

| AI 回答可修改与删除 | 说明 |
| --- | --- |
| 修改 | `AnswerPanel` 每条回答下方新增「编辑」「删除」（`aria-label` 带序号，便于读屏与测试）。编辑时就地展开：内容 textarea、来源下拉、「保存修改」「取消」；同一时刻只允许一条处于编辑态。**保留首次保存的 `createdAt`**，不新增字段，因此 `schemaVersion` 不变 |
| 删除 | 走共用的 `ConfirmDialog` 二次确认；删空最后一条时状态从 `answered` 退回 `prompted`（无提示词则 `cast`），`verified` 不回退——后续验证是独立填写的内容 |
| 连带修正 | 「保存回答」原本无条件把状态写成 `answered`，会让已填后续验证的卦例降级；现在 `verified` 保持不变。另外「保存回答」在没有可关联提示词时原本静默返回（按钮看起来可点却毫无反应），现在给出明确提示 |

| 版本与交付 | 内容 |
| --- | --- |
| 版本 | 包版本升至 0.3.4；`schemaVersion` 2 / `engineVersion` 0.2.0 / `promptVersion` 2.1.1 均不变（只改 UI、异常兜底与调用点，未动数据结构与排盘） |
| 验证 | `npm run lint` 通过；`npm test` 327 项通过（新增 22 项：`createId` 3 项、降级仓库 1 项、存储访问异常 1 项、history 禁用下的导航 2 项、错误边界 3 项、存储不可用的端到端降级 1 项、回答编辑删除 8 项、反馈相关 3 项）；`npm run build` 扫描 `0 violations`（产物 392.68 kB / gzip 134.62 kB）；`npm run test:e2e` 23 项通过。三处新反馈在 320px 真实浏览器里逐项截图核对过浅色与夜间两种模式，并用命中测试确认保存失败提示不遮挡按钮 |
| 交付 | `release/wenyao-xhs-0.3.4.zip`，133788 字节，SHA-256 `e34dde3a995c7b4efab1feb1fd0010b619727ad057448e7992f1b7cbc089c04b`，产物 `assets/index-Co6dgS-j.js`（392682 字节）；`index.html` 位于 ZIP 根目录，ZIP 内只有这两个文件。0.3.3 的 ZIP 原样保留，其摘要归档为 `release/release-summary-0.3.3.md` |
| 提审前仍需 | 在小红书 PC 模拟器与真机上按 `docs/xhs-review-guide.md` 第 4 节走一遍，重点是第 22 项（容器兼容：每个按钮都要有可见反应、不允许整页空白）、第 14 项（按钮反馈）与第 6 项（回答的编辑与删除） |

排查用的"逐一禁用某 API"环境模拟脚本是一次性工具，验证后已删除，等价场景已固化成上面的单元与集成用例。

## 2026-09-29 卦例记录批量删除与 0.3.3 发布

历史页新增多选删除，用于一次性清理多条旧卦例（存储满时的清理入口）。

| 改动 | 说明 |
| --- | --- |
| 交互 | 工具栏新增「管理」进入选择模式，卡片左侧出现复选框、点击整张卡片即勾选（不再跳转结果页），卡片上的「修改为副本」与单条「删除」隐藏；选择模式顶部为「已选 N 条 / 可删 M 条」「全选 / 取消全选」「完成」与主操作「删除选中（N 条）」，确认框复用 `ConfirmDialog`（文案含条数） |
| 范围 | 「全选」只作用于当前列表可见项，即搜索时只删除命中的记录；搜索与清除搜索都会清空选择；迁移失败的只读记录不参与（与现状一致，仍无删除入口），有只读记录时在选择模式下明确提示"另有 N 条只读记录不参与批量删除" |
| 存储层 | `CaseRepository` 新增 `deleteMany(ids)`：单次连接、单个 `readwrite` 事务内逐条删除，因此要么全部生效要么全部回滚；id 不存在或重复时静默跳过。为此新增 `withWriteTransaction`，它在 `transaction.oncomplete` 才 resolve——`withStore` 只等到单次请求成功，不足以代表落盘。现有 `put`/`delete` 仍用 `withStore`，本次未改 |
| 顺带修复 | 删除成功后原本一律重载全部记录，因此在搜索状态下删除会跳回全量列表，备份导出与「共 N 条记录」也会停留在删除前的全量快照。现在重载逻辑改为读取「全量列表 + 已生效搜索结果」两件事：有生效搜索时列表维持过滤，全量列表始终刷新以保证计数与备份内容准确。单条删除、批量删除、备份恢复后走同一条路径；「清除」和未搜索时的行为不变。判定依据是新增的 `appliedQuery` ref（只在事件处理器里读写，不进渲染，因此不会让重载函数每次搜索都多跑一轮），**不是**输入框内容——输入框里打了字但没点「搜索」时列表仍保持原样 |
| 版本 | 包版本升至 0.3.3；排盘引擎、数据结构与提示词未变，`schemaVersion` 2 / `engineVersion` 0.2.0 / `promptVersion` 2.1.1 保持原值 |
| 验证 | 新增 `deleteMany` 单测 2 项、历史页集成用例 7 项（勾选删除、全选清空、搜索结果内全选后列表仍保持搜索结果、搜索状态下单条删除同样保持、退出选择模式、只读记录不可选）、e2e 1 项（320px 全选删除 19 条长列表并断言无横向溢出）；`npm run lint` 通过；`npm test` 305 项通过；`npm run build` 扫描 `0 violations`；`npm run test:e2e` 23 项通过。另在 320px 真实浏览器里逐屏截图核对浅色与夜间模式的选择态与确认框。保持搜索结果的两条集成用例已用临时还原旧逻辑确认过：修复前稳定失败、修复后通过 |
| 交付 | `release/wenyao-xhs-0.3.3.zip`，132397 字节，SHA-256 `78054d58ebd1df3f33650f0841cd055835ef696e96554e9a1f8ffb6aee396479`，产物 `assets/index-B2g3g0c9.js`（387747 字节）；`index.html` 位于 ZIP 根目录，ZIP 内只有这两个文件。0.3.2 的 ZIP 原样保留，其摘要归档为 `release/release-summary-0.3.2.md` |

两处非功能性的过程记录：

- 新加的两条"保持搜索结果"集成用例最初写的等待条件是"某条标题消失"，但搜索加载期间整张列表都不渲染，这个条件会在加载中途提前成立，导致后续点击偶发落空（全量跑出现过 1 次失败）。已改为等待"列表只剩命中的那一条"，随后连续 4 次全量 `npm test` 稳定通过。
- `CaseRepository.deleteMany` 的返回值为 `Promise<void>` 而非条数：IndexedDB 对不存在的 key 执行 delete 同样静默成功，能返回的只是"提交的条数"，对界面没有信息量。

## 2026-09-24 交互反馈与 0.3.2 发布

- 首页「最近卦例」和历史页读取期间显示加载状态，区分读取中、空记录与读取失败；历史页搜索期间也显示进度。
- 「备份与恢复」入口移到历史页顶部并默认收起；即使列表处于搜索结果，导出仍包含全部记录。
- 共用确认框挂到页面根节点，修复长历史列表中删除弹窗偏离当前视口的问题。
- 包版本升至 0.3.2；排盘引擎、数据结构与提示词未变，其内部版本号保持原值。
- 门禁：`npm run lint` 通过；`npm test` 297 项通过；`npm run build` 扫描 `0 violations`；`npm run test:e2e` 22 项通过。
- 交付：`release/wenyao-xhs-0.3.2.zip`，133055 字节，SHA-256 `03df22b08b7ecfecfd710c059f6c7fe19e36413435e8050b768ce1224cb674fe`。0.3.1 的 ZIP 保留，其摘要归档为 `release/release-summary-0.3.1.md`。

## 2026-09-22 修复：手动排盘完成后上一轮信息粘住

审核发现的缺陷：手动排盘生成正式结果并退出后，再次进入仍然是上一轮的问题、备注与卦象，且界面没有任何清除入口，无法开始新一轮。

根因：`useManualEditor` 在挂载时无条件恢复 `wenyao:manual-editor-draft:v1`，而 `complete()` 从不清除草稿。这是为满足规格 `docs/superpowers/specs/2026-08-31-navigation-manual-editor-redesign.md:48`「从手动排盘生成结果后，**返回时**恢复完整手动排盘草稿」而做的保留，但实现没有给草稿任何结束边界，于是"从结果页返回"这个预期场景与"退出后重新进入"变成同一条代码路径。`discardDraft` 早已存在却从未接到任何 UI，所以用户也无从清除。`tests/integration/manual-flow.test.tsx:53`「并保留可恢复草稿」把这个过宽的行为固化成了测试，因此一直没暴露。

修复：给草稿快照增加 `completed` 标记，把是否恢复收敛为一条规则 ——

| 进入方式 | 草稿状态 | 行为 |
| --- | --- | --- |
| 从结果页返回上一层（`direction === 'back'`） | 任意 | 恢复草稿，便于继续校正（规格 3.1） |
| 从首页重新进入（`direction === 'forward'`） | 未完成 | 恢复草稿，不静默丢弃未写完的录入（规格 11） |
| 从首页重新进入（`direction === 'forward'`） | 已完成 | 起全新一轮，并清掉已完结的草稿 |

`complete()` 成功后把草稿标记为 `completed` 并保留（因此 `manual-flow.test.tsx:53` 断言依旧成立），草稿文件只在"已完结且从首页重新进入"时清除。判定依据用的是导航栈已有的 `direction`，未新增任何导航状态。

验证：新增 `tests/integration/navigation-flow.test.tsx` 的「手动排盘草稿的生命周期」三条用例，修复前「已生成结果的草稿不再带进下一次进入」稳定失败（`Expected: 空 / Received: 第一轮的问题`），修复后三条全通过；另外在真实浏览器里逐一确认了完成→返回首页→再进入为空白、从结果页返回恢复草稿、未写完的草稿仍可恢复。全量 294 个测试、lint 与构建扫描 `0 violations` 均通过。

交付：本修复与夜间模式一起打成 `release/wenyao-xhs-0.3.1.zip`（131084 字节，SHA-256 `99ffc416cd9ba2cb2048d36804d6f4859babd543d779f28c66b1ac8f0892cd36`），产物名 `assets/index-Clikg45u.js`。按用户要求本次未在本地跑 e2e（改由实机按 `docs/xhs-review-guide.md` 验收）；打包前 `lint` 与 `npm test`（含 build 与 `verify:xhs` 全量扫描）通过。0.3.0 的交付记录已归档为 `release/release-summary-0.3.0.md`，其 ZIP 未被覆盖。

## 2026-09-22 夜间模式

对照文档：`docs/architecture.md` 新增「主题与配色」一节。

| 改动 | 说明 |
| --- | --- |
| 令牌层 | `src/styles/tokens.css` 拆出角色令牌（`--surface-rgb`、`--overlay-rgb`、`--input-bg`、`--tint-base`、`--coin-face`、`--body-glow`、`--cinnabar-solid`）并增加 `:root[data-theme='dark']` 深色块；`color-scheme` 随主题切换 |
| 样式层 | `src/styles/global.css` 里 26 处假定浅色的字面量全部改为令牌引用；剩余 3 处字面量（朱砂实心按钮与铜钱的白字、对话框黑色遮罩）在两种主题下都成立，保持原样 |
| 主题状态 | 新增 `src/styles/theme.ts`，`<html data-theme>` 由它写入；偏好存 `wenyao:theme`，未写入时跟随系统并响应其变化 |
| 入口 | `src/main.tsx` 在 `createRoot` 之前调用 `initTheme()`，同时让 `meta[name="theme-color"]` 跟随主题，容器状态栏不再与页面底色脱节 |
| UI | 首页新增「夜间模式」开关（用 `aria-pressed` 表示开启），放在副标题下方右对齐的 `.home-toolbar` 中 |
| 验证 | 新增 `tests/e2e/theme.spec.ts`（跟随系统 / 手动覆盖并持久化 / 底色与卡片取值、`color-scheme`、`theme-color`、320px 无溢出）；深色令牌对比度按 WCAG AA 逐项数值校验，全部 ≥ 4.5:1 |

版本号不变：本次只改样式与 UI，未触及引擎、数据结构与提示词，`schemaVersion` / `engineVersion` / `promptVersion` 均不动。

浅色回归证明：把工作区 stash 回 `5ffec44` 重新构建后，在同一固定时钟与随机种子下逐页截图比对——掷卦录入页、模拟铜钱页、手动排盘页、卦例记录页四页与新版**逐字节一致**；结果页最大通道差 1/255（6 处强调色淡底由字面量改为 `color-mix` 后的取整，低于 8 位量化阈值）；首页差异来自新增开关导致的预期下移。

### 顺带修复：`npm run dev` 一直白屏

本次启动开发服务器验收时发现该问题，与夜间模式无关，但会让 README 里记录的 `npm run dev` 完全不可用，因此一并修复。

根因：`vite.config.ts` 的 `define: { 'navigator.connection': 'undefined' }`（用于让构建产物通过 `device-api` 扫描规则、并满足 `xhs-build-output.test.ts` 的 `not.toContain('navigator.connection')`）在 dev 下被 Vite 客户端以**赋值**方式实现——`node_modules/vite/dist/client/env.mjs` 会遍历 define 的键并对全局对象逐段赋值，即执行 `navigator.connection = 'undefined'`；而 `navigator.connection` 是只读访问器，赋值抛 `TypeError`。该脚本先于应用脚本执行，导致 `#root` 始终为空、整页白屏（控制台重复三条同样的 TypeError）。构建路径走 esbuild 文本替换，不受影响。

修复：把 define 收敛到构建期，dev 下不注入（`define: command === 'build' ? {...} : {}`），并在配置里注明原因。已验证构建产物**逐字节不变**（修复前后 `dist/assets/*.js` 与 `dist/index.html` 的 sha256 完全一致），dev 下可正常渲染、开关可切换且刷新后保留。

## 2026-09-11 时间基准与节气精度修复

对照计划：`docs/superpowers/plans/2026-09-11-timezone-and-solar-term-accuracy.md`（四项已确认缺陷）。

| 缺陷 | 修复 |
| --- | --- |
| 结果页/历史页/回答时间固定早 8 小时（直接截取 ISO 前 16 位） | 新增 `engines/calendar/zoned-time.ts` 统一格式化，三处展示改用北京时间并标注时区 |
| 提示词输出裸 UTC 时刻，与按设备本地算出的四柱冲突 | 提示词输出 `起卦时间：YYYY-MM-DD HH:mm（北京时间 UTC+8）`、`排盘时区` 与三行排盘规则声明；专业版 JSON 增加 `castAtLocal`、`timeZone`、`rules`、`sizhuOverridden`；四柱被人工校正时文字与 JSON 都如实标注 |
| 节气用固定公历日期（2026 年有 5 个"节"整整差一天，且全部缺交节时刻） | 新增 `engines/calendar/solar-terms.ts` + 1899–2100 数据表，年月柱改为按交节时刻比较；与香港天文台 2019–2028 年 120 项逐项核对，最大偏差 60 秒 |
| 排盘依赖宿主时区（UTC 环境得到不同四柱） | 引擎改为「绝对时刻 + 时区偏移」输入，禁止读取宿主本地字段；数据模型增加 `timeZone`（`schemaVersion` 2，v1 迁移补默认值并标记 `assumed`，快照不改写） |

顺带修正的取时与一致性行为：

- 现场摇卦的起卦时间改为**得卦时刻**（六爻齐备那一刻），确认页提供人工校正入口与"使用当前时间"；开始时刻另记 `castStartedAt`，不参与排盘。
- 手动排盘改时间时自动清除受时间影响的覆盖（四柱、爻级旬空）并在状态区提示"已按新时间重算"，不再需要用户记得点"使用起卦时间重新计算"。
- 手动排盘的 `datetime-local` 按北京时间解释与回填，并限制在 1900–2100。

版本号：`schemaVersion` 1 → 2、`engineVersion` 0.1.0 → 0.2.0、`promptVersion` 2.0.0 → 2.1.0（`docs/architecture.md` 中原本记为 1.0.0 的 promptVersion 属文档漂移，已一并修正）。

同版本内另加**备份与恢复**兜底入口（`src/features/history/backup-format.ts`、`BackupPanel.tsx`）：

- 导出为一段纯文本（头部是人类可读的目录，正文每行一条 JSON 记录），只读原始记录默认一并导出——这是数据被清空时的抢救手段。
- 恢复时整段粘贴即可：已存在的 id 一律跳过并计数，不覆盖也不删除任何现有数据；无法解析的行单独计数，不让整份备份失败；只读原始记录也能恢复并以只读形态展示。
- 全程不调用剪贴板 API、不写文件、不联网，"复制"由平台长按菜单完成（构建扫描器对此有强制规则）。
- 为此在仓库层新增 `hasRecord`（`get` 对只读记录返回 null，不能用于冲突判断）与 `putRaw`（恢复专用原样写入）。

门禁：`npm test` 286 项在 `TZ=Asia/Shanghai`、`TZ=UTC`、`TZ=America/New_York` 三组环境下全部通过且结果一致；`npm run lint` 0 问题；`npm run build` 扫描 `0 violations`；`npx playwright test` 18 项通过（含 UTC 设备用例与备份导出/恢复端到端）；产物体积 378,696 字节（相对 0.1.0 增加 28,989 原始 / 11,452 gzip）。

升级兼容已被测试固化（`tests/unit/case-db.test.ts`、`tests/unit/draft-store.test.ts`）：把 0.1.0 形态的记录（`schemaVersion` 1、无 `timeZone`、四柱快照来自旧近似节气）直接写进 IndexedDB，再经新版仓库读出，断言补时区、快照逐字段不变、仍可写回；读不出的记录以只读保留且原始数据不删除；现场摇卦活动草稿同样跨版本恢复。

打包与交付：`release/wenyao-xhs-0.2.0.zip`（130,111 字节，SHA-256 `9f7727f4…`，构建时间 2026-09-11 18:45 +08:00，`index.html` 位于根目录，逐文件哈希与当前 `dist/` 一致）；交付记录写入 `release/release-summary.md`，已上传的 0.1.0 记录另存为 `release/release-summary-0.1.0.md`，0.1.0 的 ZIP 原样保留。`scripts/package-xhs.ps1` 改为从 `package.json` 读取版本号（不传 `-OutputPath` 时自动命名 `release/wenyao-xhs-<版本>.zip`，摘要版本号同源），此前版本号在脚本里硬编码为 0.1.0。**该 ZIP 已包含下述 09-11 复核修正**（含最后的注释范围修正），可直接用于上传前验证。

尚未完成：真机验收（`docs/xhs-review-guide.md` 第 4 节清单，含新增的时区、节气边界与备份两项）与小红书容器上传。

## 2026-09-11 发布复核修正

对照设计：`docs/superpowers/specs/2026-09-11-release-review-fixes-design.md`（四处一致性问题的复核结论：全部成立）。

| 修正 | 改动 |
| --- | --- |
| 旧版卦例时区提示 | `HistoryPage` 的卡片对 `timeZone.assumed === true` 的记录显示"旧版记录未保存时区，现按北京时间显示；原排盘结果未重新计算。"；结果页不重复显示；不重算任何旧快照 |
| 节气来源表述 | 提示词文字（`prompt/engine`、`prompt/formatter`）与结构化 JSON（`prompt/structured`）改为"内置离线节气表（寿星万年历算法生成，覆盖 1899–2100 年；2019–2028 年的十二节与香港天文台公布值核对，误差不超过 1 分钟）"，不再声称整张表直接取自香港天文台；数据表表头、生成脚本 `scripts/generate-solar-terms.mjs` 与 `solar-terms.ts` 头部注释的同一说法一并改正（前两处重新生成数据表，数据行未变、仅表头变化；注释处补上"其中 2019–2028 年十二节"的核对范围） |
| `castStartedAt` 恢复语义 | `useCaseSession.restoreState` 改为保留草稿里的 `castStartedAt`（`?? null`），不再在恢复时清空；`castAt` 仍在第六爻完成时更新，是唯一参与四柱的时间 |
| 发布元数据 | 本节记录的 ZIP 大小与 SHA-256 已与 `release/release-summary.md` 对齐 |

`PROMPT_VERSION` 由 2.1.0 提升到 **2.1.1**：改的是写进提示词、供外部 AI 阅读的规则文案，同一版本号不应对应两段不同文字。schema 与 engine 版本未动，未改动排盘结果、ZIP 结构与节气数据。

门禁：`npm test` 291 项在 `TZ=Asia/Shanghai`、`TZ=UTC`、`TZ=America/New_York` 三组环境下全部通过；`npm run lint` 0 问题；`npm run build` 扫描 `0 violations`；`npx playwright test` 18 项通过。修正完成后已重新打包：`release/wenyao-xhs-0.2.0.zip`（130,111 字节，SHA-256 `9f7727f4…`），清单里 `assets/index-RDQdcdA5.js` 的 SHA-256 `7ecbfda9…` 与当前 `dist/` 一致。

## 总览

| 任务 | 内容 | 提交 | 状态 |
| --- | --- | --- | --- |
| Task 1 | 工程基线与小红书构建护栏 | `ccbd530` | ✅ 完成 |
| Task 2 | 领域模型、版本与固定案例 | `3738825` | ✅ 完成 |
| Task 3 | 铜钱起卦与六十四卦内核 | `c0f33fa` | ✅ 完成 |
| Task 4 | 四柱、纳甲与完整排盘管线 | `61dce64` | ✅ 完成 |
| Task 5 | 草稿、IndexedDB 卦例与版本迁移 | `99794d2` | ✅ 完成 |
| Task 6 | 起卦与手动排盘交互 | `c313d83` | ✅ 完成 |
| Task 7 | 可解释离线初判引擎 | `0b8d45b` | ✅ 完成 |
| Task 8 | AI 提示词、回答回填与结果卡 | `590534a` | ✅ 完成（有降级项，见下） |
| Task 9 | 卦例时间线、搜索与修改副本 | `1801e18` | ✅ 完成 |
| Task 10 | E2E 验收、文档和发布包 | `d60c3c5` | ✅ 完成 |

最终门禁（Task 10 Step 5）：`npm ci` ✅ → `lint` 0 问题 ✅ → `test` 132 通过 ✅ → `build` 0 违规 ✅ → `playwright test` 8 通过 ✅。

## 2026-08-30 经典文本参考增量

- 新增文王卦序 1–64 的完整本地语料：64 条卦辞、384 条常规爻辞、乾卦“用九”和坤卦“用六”，每段均配项目原创白话。
- 结果页始终展示本卦卦辞；只突出本卦实际动爻；静卦不擅自指定爻辞；变卦只展示变化后的整体卦辞；全部爻辞默认折叠。
- 古典原文对照 Chinese Text Project《周易》、Project Gutenberg ebook 25501 与维基文库《周易》，详细编辑原则见 `docs/classics-sources.md`。
- 白话不硬编码爱情、事业、财运吉凶，不替代纳甲、世应、六亲、日月和动变关系的综合判断。
- 完整性测试锁定 64 卦名称与引擎表一一对应、爻位 1–6、文本非空、乾坤特殊条目及确定性禁语。
- 增量门禁：`lint` 0 问题 ✅ → `test` 145 通过 ✅ → `build` 0 违规 ✅ → `playwright test` 8 通过 ✅。

## 各任务步骤完成明细

### Task 1 工程基线（6/6 步）
扫描器失败测试→红→Vite 工程与扫描器→应用壳与设计令牌→基线验证→提交，全部按计划完成。`.gitignore` 覆盖 node_modules、dist、上传压缩包（zip/tgz）、截图（png/jpg）、playwright 产物。

### Task 2 领域模型（5/5 步）
草稿默认值、爻值校验、ISO 时间、正式结果必须有 chart、回答必须关联 promptId、修改副本必须填 parentCaseId，均有测试。`ValidationResult` 为显式 `{ok} | {ok:false, issues}` 结构。

### Task 3 铜钱与六十四卦内核（6/6 步）
正面 3/反面 2 约定、注入伪随机序列、64 卦名称唯一性、动爻 0..6 组合、静卦 `changed=null`、六爻皆动 `allChanging`。移植自 `D:\HexaAgent\frontend\src\utils\hexagrams.ts` 与 `backend/app/core/bagua.py`，仅纯算法与数据表。

### Task 4 四柱与纳甲管线（7/7 步）
立春前后、节气月边界、23 点子时、1900-01-01 基准、六个旬首测试；八卦纳支、五行五关系、十日干六神起位、世位 1..6 应位隔三；变卦六亲用本卦卦宫回归测试（坤为地→乾为天用坤宫土）；伏神"用神未现但伏藏"案例（地雷复）；节气 ±1 日风险已记录于 `docs/algorithm.md`。

### Task 5 存储层（5/5 步）
草稿保存/恢复/损坏清理/单活动草稿/未完成保存；IndexedDB 增删改查/倒序/搜索/多回答/副本 `parentCaseId`；当前版本直读、未来版本只读、迁移异常只读、`QuotaExceededError` → `StorageFullError` 且不删旧记录。

### Task 6 起卦与手动排盘（6/6 步）
问题→方式→投币→确认状态机；每轮保留正反面与爻值；撤销；修改已完成爻二次确认；草稿卸载恢复；直接录入与阴阳动静等价输入；实时预览；专业字段折叠；字段覆盖；缺失字段阻止正式结果并指出缺失爻；`aria-label` 与减少动态降级。

### Task 7 初判引擎（5/5 步）
九类候选用神（感情类候选集合 + 确认提示，不预设性别）；规则顺序与依据逐条有测试；冲突时"信号复杂"；禁语全量扫描（4 固定案例 × 9 类别）；ruleId 可回溯；健康/法律/财务专门提示。

### Task 8 提示词与结果卡（5/5 步，含降级项）
精简版/专业版内容边界、`PROMPT_VERSION` 快照、七条 AI 输出约束；首屏主卡；朱砂色"已问过 AI？粘贴回答"；多来源回答不覆盖；未回答提醒；"全选内容"仅用 `textarea.select()`（全仓无 clipboard API 调用）；截图卡为移动端竖版宽度。

### Task 9 历史时间线（4/4 步）
倒序、首页最近三条、四字段搜索、状态标签映射、删除确认、复制副本不覆盖原记录；只读降级（原始 JSON 摘要、无编辑入口）；存储满提示不静默丢数据。

### Task 10 发布准备（7/7 步）
四个 E2E spec（摇卦保存、手排回填、离线、320/375/430px 布局 + 减少动态）；README / architecture / privacy / xhs-review-guide 四份文档；`npm ci` 全量验证；产物检查 0 violations。

## 与计划的文件结构偏差

功能等价、位置或命名不同，均已在代码中注明：

| 计划 | 实际 | 原因 |
| --- | --- | --- |
| `components/{Coin,CoinRound,...}.tsx` 多文件 | `components/index.tsx` 单文件导出（含 Coin、YaoStack、ProgressHeader、ConfirmDialog、HexagramLines、Disclaimer、Disclosure） | 组件均为小件，合并降低文件数 |
| `cast/CoinRound.tsx` | `cast/CoinStage.tsx`（模拟）+ `cast/PhysicalCoinStage.tsx`（现实录入） | 两种模式行为差异大，分开更清晰 |
| `result/CaseDetail.tsx` | 未单独建文件；查看详情复用 `ResultPage`，只读记录用 `HistoryPage` 内联 `ReadonlyCard` | 结果页已承担详情职责 |
| 计划外 `features/shared/categories.ts`、`features/history/status.ts` | 新增 | 消除 react-refresh only-export-components 警告 |
| 计划外 `src/features/result/index.tsx` 无 | — | — |
| `vitest.config.ts`（计划未列） | 新增 | 测试环境 jsdom + 排除 e2e 目录 |

## 已知降级项（功能存在但不完整）

1. **专业编辑字段覆盖只开放部分**（Task 6 Step 2 / 规格 §7.2）：`buildChart` 的 overrides API 支持干支、六亲、六神、世应、旬空逐爻覆盖（有测试），但 `ProfessionalEditor` UI 目前只暴露**起卦时间**与**六神覆盖**；四柱、世应、旬空等字段的 UI 编辑入口待补。
2. **长内容拆分截图卡未实现**（规格 §8.3）：首版主卡为单张竖版卡，"每条爻卡按截图尺寸拆成视觉连续的多张卡片"未做。
3. **IndexedDB 配额异常未做端到端模拟**：`QuotaExceededError → StorageFullError` 通过映射函数与 localStorage 模拟测试覆盖，未在 fake-indexeddb 中真实触发配额。
4. **E2E 未保存截图产物**（Task 10 Step 3）：布局验证用 scrollWidth 断言代替截图存档。

## 最终验收清单对照

| # | 验收项 | 结论 |
| --- | --- | --- |
| 1 | 三种录入方式产出相同 `DivinationCase` 数据链 | ✅ |
| 2 | 64 卦、6/7/8/9、0..6 动爻、纳甲、六亲、六神、世应、旬空、伏神全有自动化测试 | ✅ |
| 3 | 变卦六亲以本卦卦宫为准的回归测试 | ✅ |
| 4 | 摇卦中断可继续；完成卦修改复制版本或二次确认 | ✅ |
| 5 | 提示词可被选中，代码未调用任何剪贴板 API | ✅（grep 验证为空） |
| 6 | 一个卦例多个回答，每个回答关联准确提示词快照 | ✅ |
| 7 | 无网络时起卦、排盘、初判、提示词、历史全部可用 | ✅（offline E2E） |
| 8 | 产物不含外部 URL、网络 API、内联脚本、Worker、WASM、iframe、下载 | ✅（扫描 0 violations + E2E 零外部请求） |
| 9 | 320px 小屏、安全区、长文本、减少动态模式 | ⚠️ 基本通过：320px 无溢出与减少动态有 E2E；安全区有 CSS 变量但无 E2E 断言；长文本无专项用例 |
| 10 | README、算法说明、隐私说明、审核说明齐全 | ✅ |

## 建议的后续迭代顺序

1. 补齐专业编辑 UI 的四柱/世应/旬空覆盖入口（API 已就绪）。
2. 截图卡拆分（多张视觉连续卡片）。
3. E2E 增加安全区与长文本专项用例及截图产物。
4. 小红书容器真机测试（`docs/xhs-review-guide.md` 第 4 节清单）。
