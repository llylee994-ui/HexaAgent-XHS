# 实施计划完成情况记录

> 对照文档：`docs/superpowers/plans/2026-08-27-xiaohongshu-hexa-tool-implementation.md`
> 记录日期：2026-08-30 · 结论：**Task 1–10 全部完成；经典文本参考增量亦已完成。最终验收清单 9 项通过、1 项基本通过**（详见文末）。

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

打包与交付：`release/wenyao-xhs-0.2.0.zip`（129,846 字节，SHA-256 `6a5ac9f9…`，`index.html` 位于根目录，逐文件哈希与当时 `dist/` 一致）；交付记录写入 `release/release-summary.md`，已上传的 0.1.0 记录另存为 `release/release-summary-0.1.0.md`，0.1.0 的 ZIP 原样保留。`scripts/package-xhs.ps1` 改为从 `package.json` 读取版本号（不传 `-OutputPath` 时自动命名 `release/wenyao-xhs-<版本>.zip`，摘要版本号同源），此前版本号在脚本里硬编码为 0.1.0。

**注意：该 ZIP 早于下述 09-11 复核修正**，源码已变化，上传前必须重新执行 `npm run build` 与 `scripts/package-xhs.ps1` 并重新核对摘要。

尚未完成：真机验收（`docs/xhs-review-guide.md` 第 4 节清单，含新增的时区、节气边界与备份两项）与小红书容器上传。

## 2026-09-11 发布复核修正

对照设计：`docs/superpowers/specs/2026-09-11-release-review-fixes-design.md`（四处一致性问题的复核结论：全部成立）。

| 修正 | 改动 |
| --- | --- |
| 旧版卦例时区提示 | `HistoryPage` 的卡片对 `timeZone.assumed === true` 的记录显示"旧版记录未保存时区，现按北京时间显示；原排盘结果未重新计算。"；结果页不重复显示；不重算任何旧快照 |
| 节气来源表述 | 提示词文字（`prompt/engine`、`prompt/formatter`）与结构化 JSON（`prompt/structured`）改为"内置离线节气表（寿星万年历算法生成，覆盖 1899–2100 年；2019–2028 年的十二节与香港天文台公布值核对，误差不超过 1 分钟）"，不再声称整张表直接取自香港天文台；数据表表头与生成脚本 `scripts/generate-solar-terms.mjs` 的同一说法一并改正（数据行未变，重新生成后仅表头变化） |
| `castStartedAt` 恢复语义 | `useCaseSession.restoreState` 改为保留草稿里的 `castStartedAt`（`?? null`），不再在恢复时清空；`castAt` 仍在第六爻完成时更新，是唯一参与四柱的时间 |
| 发布元数据 | 本节记录的 ZIP 大小与 SHA-256 已与 `release/release-summary.md` 对齐 |

`PROMPT_VERSION` 由 2.1.0 提升到 **2.1.1**：改的是写进提示词、供外部 AI 阅读的规则文案，同一版本号不应对应两段不同文字。schema 与 engine 版本未动，未改动排盘结果、ZIP 结构与节气数据。

门禁：`npm test` 291 项在 `TZ=Asia/Shanghai`、`TZ=UTC`、`TZ=America/New_York` 三组环境下全部通过；`npm run lint` 0 问题；`npm run build` 扫描 `0 violations`；`npx playwright test` 18 项通过。按要求**本次未重新打包**：`release/` 中的 0.2.0 ZIP 仍是对应修正前的源码。

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
