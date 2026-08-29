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
| `src/engines/calendar/calendar.ts` | `backend/app/core/sizhu.py` | 四柱推算 |
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

- 年柱：以立春为界，立春前归上一年。
- 月柱：以节气"节"为界，月干按节气年年干五虎遁。
- 日柱：以 1900-01-01 = 甲戌日为基准，60 日循环。
- 时柱：五鼠遁，23-1 点为子时。

### 已知近似边界（首版兼容实现）

1. **节气日期为固定公历近似**。节气每年在固定日期 ±1 日内浮动，月柱在节气日附近可能偏差一个月。例如立春记为 2 月 4 日，实际可能在 2 月 3-5 日之间。在节气日当天起卦的用户建议核对万年历。
2. **23 点子时不换日**。23:00-23:59 按当日日干起子时（晚子时不换日柱的简化），部分流派会在 23 点后换用次日日柱。
3. **未处理真太阳时**。统一使用本地时钟。

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
- 四柱固定案例：2026-08-28 12:00 → 丙午 丙申 甲戌 庚午，旬空申酉
