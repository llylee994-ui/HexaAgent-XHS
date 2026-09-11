# 排盘算法说明

本文档记录"问爻"离线排盘内核使用的公式、数据来源与已知近似边界。所有算法均为纯函数，不依赖网络与运行环境状态。

## 来源

算法与数据表移植自来源项目 `D:\HexaAgent`（保持只读，仅移植可验证的纯算法）：

| 本项目模块 | 来源文件 | 内容 |
| --- | --- | --- |
| `src/engines/hexagram/trigrams.ts` | `frontend/src/utils/hexagrams.ts`、`backend/app/core/bagua.py` | 八卦爻象、五行 |
| `src/engines/hexagram/table.ts` | `backend/app/core/bagua.py` | 六十四卦、八宫、世爻位（含游魂/归魂） |
| `src/engines/hexagram/engine.ts` | `backend/app/core/bagua.py` | 本卦识别、动爻翻转、变卦 |
| `src/engines/divination/coins.ts` | 自行实现（规则见下） | 铜钱换算 |
| `src/engines/calendar/ganzhi.ts` | `backend/app/core/ganzhi.py` | 天干地支、五行、五虎遁、五鼠遁、旬空 |
| `src/engines/calendar/calendar.ts` | `backend/app/core/sizhu.py` | 四柱推算（时区化改写，见下） |
| `src/engines/calendar/zoned-time.ts` | 自行实现 | 绝对时刻 ↔ 排盘时区日历字段、展示格式化 |
| `src/engines/calendar/solar-terms.ts` | 自行实现 | 十二"节"交节时刻查表、年月柱界分、支持范围校验 |
| `src/engines/calendar/solar-terms-data.ts` | 由 `scripts/generate-solar-terms.mjs` 生成 | 1899–2100 年十二"节"交节时刻数据表 |
| `src/engines/najia/nazhi.ts` | `backend/app/core/najia.py` | 八卦纳甲干支 |
| `src/engines/najia/liuqin.ts` | `backend/app/core/liuqin.py` | 六亲（环形五行生克法） |
| `src/engines/najia/liushen.ts` | `backend/app/core/liushen.py` | 六神起位 |
| `src/engines/najia/shiying.ts` | `backend/app/core/shiying.py` | 世应位置 |
| `src/engines/najia/fushen.ts` | 自行实现（规则见下） | 伏神 |
| `src/engines/najia/chart.ts` | `backend/app/core/paipan.py` | 排盘管线 |

移植时已将原地修改改为返回新对象的 TypeScript 纯函数，未复制任何 API、网络或状态代码。

## 铜钱换算

约定正面记 3、反面记 2，三枚之和为原始爻值：

| 爻值 | 名称 | 本卦 | 变卦 |
| --- | --- | --- | --- |
| 6 | 老阴 | 阴爻 | 变阳 |
| 7 | 少阳 | 阳爻 | 不变 |
| 8 | 少阴 | 阴爻 | 不变 |
| 9 | 老阳 | 阳爻 | 变阴 |

投币随机源可通过参数注入，保证测试可重复。

## 四柱推算

排盘时区固定为**北京时间（UTC+8）**，一次排盘的全部日历字段（年月日时）都在该时区内解释，与设备、容器的本地时区无关。引擎只接收"绝对时刻 + 时区偏移"，内部禁止读取 `getFullYear`/`getHours` 等宿主本地字段（有单元测试扫描源码强制）。

- 年柱：以**立春交节时刻**为界，交节前归上一年。
- 月柱：以十二"节"的**交节时刻**为界（交节当刻即属新月），月干按节气年年干五虎遁。
- 日柱：以 1900-01-01 = 甲戌日为基准，60 日循环，按排盘时区的日历日计算。
- 时柱：五鼠遁，23-1 点为子时，按当日日干起时。

### 节气数据与精度

- 交节时刻取自 `src/engines/calendar/solar-terms-data.ts`：1899–2100 年每年十二"节"，以"距当年 1 月 1 日 00:00（UTC+8）的分钟数"编码，由 `scripts/generate-solar-terms.mjs` 生成（寿星万年历算法）。
- 精度核对：`tests/unit/solar-terms.test.ts` 将数据表与**香港天文台**公布的 2019–2028 年十二"节"时刻（香港時間 = UTC+8，分钟级）逐项比较，全部在 **60 秒**以内；差异只来自公布值的取整方向与星历精度。对照数据存档在 `tests/fixtures/hko-solar-terms.ts`（含来源 URL 与取数日期）。
- 表首多收录 1899 年，用于解析 1900 年 1 月小寒之前、需要回退到上一年大雪的时刻。

### 支持范围

起卦时间限定在 **1900-01-01 至 2100-12-31（北京时间）**。超出范围时引擎抛出可读错误（"起卦时间超出支持范围"），手动排盘页把 `datetime-local` 的 `min`/`max` 设为同一区间，界面显示明确提示，不做静默近似降级。

### 明确非目标

1. **未处理真太阳时**：不做经度时差与均时差校正，四柱直接按北京时间计算（提示词中如实声明）。
2. **23 点子时不换日柱**：23:00-23:59 仍按当日日干起子时（晚子时不换日），部分流派会在 23 点后换用次日日柱；提示词中声明该项口径。
3. **历史时区与夏令时**：1949 年前中国各地时区、1986–1991 年夏令时一律按固定 UTC+8 处理，与当时地方实际用钟可能不同。

## 伏神规则（首版）

若本卦六爻的六亲中缺少某一亲（或几亲），则取本宫纯卦（如乾宫取乾为天）同位爻的六亲与地支，伏于本卦同位爻之下。变卦不布伏神。

## 变卦规则

- 只有 6（老阴）和 9（老阳）翻转，7、8 不变。
- 变卦六亲始终以本卦卦宫五行为基准，不以变卦卦宫为准（有回归测试保证）。
- 变卦世应按变卦自身世位标注。
- 六爻皆动正常生成变卦并标记 `allChanging`。

## 固定案例

见 `tests/fixtures/hexagram-cases.ts` 与 `tests/unit/` 下各测试文件：

- 乾为天静卦 `[7,7,7,7,7,7]`
- 坤为地六爻皆动 `[6,6,6,6,6,6]` → 变乾为天
- 天风姤初爻动 `[6,7,7,7,7,7]` → 变乾为天
- 乾为天初二爻动 `[9,9,7,7,7,7]` → 变天山遁
- 地雷复静卦（父母伏藏案例）`[7,8,8,8,8,8]`
- 四柱固定案例（北京时间）：2026-08-28 12:00 → 丙午 丙申 甲戌 庚午，旬空申酉
- 交节边界案例（北京时间）：2026-02-04 04:01 → 乙巳 己丑；04:03 → 丙午 庚寅（立春 04:02）；2026-09-07 22:40 → 丙申，22:41 起 → 丁酉（白露 22:41）
