# 问爻（HexaAgent-XHS）

小红书离线六爻小工具：完全离线运行的起卦、排盘、规则初判、AI 提示词与卦例归档应用。

- 独立仓库，与来源项目 `D:\HexaAgent` 完全隔离，只移植了可验证的纯算法。
- 运行时零网络请求：无 fetch、无外链、无内联脚本、无 Worker/WASM，构建后由 `scripts/verify-xhs-build.mjs` 强制扫描。
- 设计规格与实施计划见 `docs/superpowers/{specs,plans}/`。

## 环境要求

- Node.js ≥ 20（开发使用 Node 24）
- npm ≥ 10

## 常用命令

```bash
npm ci                # 按锁文件安装依赖
npm run dev           # 本地开发（vite --host 0.0.0.0）
npm test              # 单元 + 集成测试（vitest）
npm run test:watch    # 监听模式
npm run test:e2e      # 端到端测试（需先 npm run build）
npm run lint          # ESLint
npm run build         # tsc -b && vite build && npm run verify:xhs
npm run preview       # 本地预览构建产物（端口 4173）
node scripts/verify-xhs-build.mjs dist   # 单独执行产物合规扫描
```

## 目录结构

```text
src/
├── app/          路由、会话状态机（use-case-session）
├── domain/       DivinationCase 类型、版本号、工厂与校验
├── engines/      纯函数内核：divination / hexagram / calendar / najia / interpretation / prompt
├── storage/      localStorage 草稿、IndexedDB 卦例、迁移
├── features/     页面：home / cast / manual / result / history
├── components/   共用 UI 组件
└── styles/       设计令牌与全局样式
tests/
├── unit/         内核与存储单元测试
├── integration/  主流程集成测试（jsdom + Testing Library）
├── e2e/          移动端端到端测试（Playwright）
└── fixtures/     固定卦例
docs/             架构、算法、隐私、上架审核说明
```

## 数据与版本

- 每个卦例保存完整快照并记录 `schemaVersion` / `engineVersion` / `promptVersion`。
- 排盘时区固定北京时间（UTC+8）并随卦例记录，四柱与全部时间显示都与设备时区无关；起卦时间支持 1900–2100 年，年柱与月柱按真实交节时刻界分。
- 数据只在本机；「卦例记录 → 备份与恢复」可把全部记录导出为一段可长按复制的纯文本，也能整段粘贴回来恢复（只新增，不覆盖）。
- 正式卦例存 IndexedDB，未完成草稿存 localStorage（仅保留一个活动草稿）。
- 旧版本数据逐级迁移；迁移失败以只读形式保留，不静默丢弃。

## 测试策略

1. 算法：64 卦、6/7/8/9 换算、0..6 动爻、纳甲、六亲、六神、世应、旬空、伏神均有固定案例测试。
2. 规则：初判每条含规则编号，冲突时输出"信号复杂"，禁语约束有全量扫描测试。
3. 存储：草稿恢复、IndexedDB 增删改查、搜索、多回答、迁移与容量异常。
4. 集成：摇卦、手排、结果闭环、历史时间线（jsdom）。
5. E2E：375px 小屏完成摇卦保存与手排回填、离线可用性、320/375/430px 无横向溢出、减少动态模式、UTC 设备下的北京时间显示。
6. 时区：同一绝对时刻在 `TZ=Asia/Shanghai`、`TZ=UTC`、`TZ=America/New_York` 下四柱一致（`time-zone-invariance.test.ts` 并扫描 `src/engines` 是否存在宿主时区读取）。

## 发布

产物为 `dist/` 单入口静态站点，打包与上架步骤见 `docs/xhs-review-guide.md`。
