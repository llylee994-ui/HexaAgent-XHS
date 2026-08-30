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
  ├── calendar/      四柱、旬空（节气近似实现）
  ├── najia/         纳甲、六亲、六神、世应、伏神、排盘管线
  ├── interpretation/ 可解释规则初判（ruleId 可回溯）
  └── prompt/        精简/专业提示词
```

存储层不重新解释排盘数据；引擎层不感知存储与 UI。

## 数据流

所有录入方式（模拟铜钱、现实投币、手动排盘）最终收敛为同一条链：

```text
原始爻值 rawValues[0..5]（索引 0 = 初爻）
  → buildChart(rawValues, castAt, overrides?)  唯一正式排盘入口
  → DivinationCase（含 chart、observations、prompts、answers）
  → IndexedDB 持久化（完整快照 + 三级版本号）
```

- 摇卦过程中每次变化自动写入 localStorage 活动草稿；完成即清理。
- 结果页的每次保存（提示词/回答/卦例信息）通过 `onChange` 交回 App，同步写入 IndexedDB。
- 修改完成卦象只能复制新版本（`parentCaseId` 关联），不覆盖原记录。

## 版本策略

| 字段 | 当前值 | 说明 |
| --- | --- | --- |
| `schemaVersion` | 1 | 数据结构版本，迁移表按版本逐级升级 |
| `engineVersion` | 0.1.0 | 排盘内核版本 |
| `promptVersion` | 1.0.0 | 提示词模板版本 |

保存完整快照保证未来升级后旧卦例仍呈现当时结果。迁移失败或来自更新版本的数据以只读展示（`caseRepository.listEntries()` 返回 `readonly` 条目）。

## 离线与沙箱约束

- 运行时禁止：fetch/XHR/WebSocket/WebRTC、内联脚本、`eval`/`new Function`、Worker/Service Worker、WASM、iframe、下载、外链。
- 构建扫描器 `scripts/verify-xhs-build.mjs` 对 `dist/` 全量扫描上述能力，`npm run build` 内嵌执行。
- E2E `offline.spec.ts` 验证：零外部请求 + 缓存重载后核心流程可用。

## 专业覆盖

`buildChart` 的 `overrides` 参数支持覆盖四柱与逐爻字段（干支、六亲、六神、世应、旬空），覆盖发生在引擎计算之后，被覆盖的字段记入 `overriddenFields`；覆盖地支时五行、六亲与旬空随之重算。
