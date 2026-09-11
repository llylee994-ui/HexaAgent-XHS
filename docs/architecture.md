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
- 结果页的每次保存（提示词/回答/卦例信息）通过 `onChange` 交回 App，同步写入 IndexedDB。
- 修改完成卦象只能复制新版本（`parentCaseId` 关联），不覆盖原记录。

## 排盘时区

- 唯一排盘时区是**北京时间（UTC+8）**，定义在 `src/domain/time-zone.ts`（`CAST_TIME_ZONE`）。
- 绝对时刻 ↔ 时区日历字段的换算集中在 `src/engines/calendar/zoned-time.ts`，是引擎里唯一的时间换算入口。
- 引擎不得读取宿主本地字段；`tests/unit/time-zone-invariance.test.ts` 会扫描 `src/engines` 源码强制这一点。
- 手动排盘的 `datetime-local` 输入按北京时间解释与回填，不跟随设备时区。
- 迁移自 v1 的旧记录没有保存时区，迁移时补默认值并标记 `timeZone.assumed = true`，界面按北京时间显示；其 `chart` 快照保持原样，不重算。

## 版本策略

| 字段 | 当前值 | 说明 |
| --- | --- | --- |
| `schemaVersion` | 2 | 数据结构版本，迁移表按版本逐级升级（v1 → v2 补 `timeZone`） |
| `engineVersion` | 0.2.0 | 排盘内核版本（0.2.0 起节气按交节时刻、时区固定北京时间） |
| `promptVersion` | 2.1.0 | 提示词模板版本（2.1.0 起输出本地时间、时区与排盘规则声明） |

保存完整快照保证未来升级后旧卦例仍呈现当时结果。迁移失败或来自更新版本的数据以只读展示（`caseRepository.listEntries()` 返回 `readonly` 条目）。

## 离线与沙箱约束

- 运行时禁止：fetch/XHR/WebSocket/WebRTC、内联脚本、`eval`/`new Function`、Worker/Service Worker、WASM、iframe、下载、外链。
- 构建扫描器 `scripts/verify-xhs-build.mjs` 对 `dist/` 全量扫描上述能力，`npm run build` 内嵌执行。
- E2E `offline.spec.ts` 验证：零外部请求 + 缓存重载后核心流程可用。

## 专业覆盖

`buildChart` 的 `overrides` 参数支持覆盖四柱与逐爻字段（干支、六亲、六神、世应、旬空），覆盖发生在引擎计算之后，被覆盖的字段记入 `overriddenFields`；覆盖地支时五行、六亲与旬空随之重算。
