# 小红书上架审核操作说明

本文档描述从构建到提审的完整操作流程，供发布与复审使用。

## 1. 构建产物

```bash
npm ci
npm run lint
npm test
npm run build        # Vite 构建 → 经典脚本处理 → verify:xhs
npm run test:e2e     # 需先完成 build；本地起 4173 预览
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-xhs.ps1 -IconPath release/wenyao-icon-512.png
```

`npm run test:e2e` 预览的是已经转换和扫描过的最终 `dist/`，不能用开发服务器预览代替。全部通过后，发布脚本会把 `dist/` 的**内容**压缩到 `release/wenyao-xhs-0.1.0.zip`，并重新打开 ZIP 逐项核对文件与哈希；`index.html` 位于 ZIP 根目录。`release/` 仅为本地交付产物，不提交 Git。

本地门禁通过后，先把 ZIP 与图标上传小红书 PC 模拟器预览，再按第 4 节进行真机测试；平台容器验收不替代本地测试。

## 2. 合规自检清单

每次发版前逐项确认：

- [ ] `node scripts/verify-xhs-build.mjs dist` 输出 `0 violations`
- [ ] `dist/index.html` 是唯一 HTML 入口，入口脚本为外置经典 `defer` 脚本，脚本/样式引用均为包内相对路径
- [ ] 产物中无 `http://`、`https://` 外链、无 `fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource`/`WebRTC`
- [ ] 无 `type="module"`、模块语法、内联脚本、`eval`、`new Function`、Worker、Service Worker、WASM、iframe、`download`、`target=_blank`
- [ ] E2E `offline.spec.ts` 通过（零外部请求 + 离线重载可用）
- [ ] `release/release-summary.md` 显示 ZIP 小于 2MB，根入口、扩展名和逐文件哈希全部通过

## 3. 能力声明

本工具不需要以下容器能力，审核资料中可如实声明：

- 网络（零请求）、账号/登录、支付、广告
- 下载、剪贴板写入（复制由用户长按完成）、文件导出
- 地理位置_storage 之外的全部系统权限

需要的存储能力：IndexedDB（正式卦例）与 localStorage（设置与活动草稿）。

## 4. 真机测试要点

在小红书容器中逐项检查：

1. 首页三个入口可点，最近卦例正常展示。
2. 模拟摇卦六轮动画与结果正常；中断后重进可恢复草稿。
3. 现实投币录入正反面切换正常。
4. 手动排盘搜索卦名后自动填充六神、世应与纳甲信息；六爻按上爻到初爻编辑，人工校正与恢复自动值正常。
5. 生成提示词 → 全选 → 长按复制可用（长按菜单为平台能力）。
6. 粘贴回答、多来源保存、刷新后数据仍在。
7. 历史搜索、删除确认、修改副本正常。
8. 320px 小屏无横向溢出，安全区（刘海屏）不被遮挡。
9. 飞行模式下打开小程序，核心流程可用。

10. 非首页页面顶部返回按钮可回到上一层；浏览器系统返回不会退出应用，历史搜索词和滚动位置可恢复。
11. 专业手动排盘的搜索框支持键盘上下选择与 Escape 收起，四柱与六爻字段均可触达，页面不出现 6/7/8/9 原始数值输入。
12. 生成专业版提示词后检查可读排盘与 fenced JSON 同源，JSON 包含 `original`、`changed` 和 `overriddenFields`；精简版不出现 JSON 块。
13. 用键盘检查 focus ring、阴阳/动静的 pressed 状态、伏神 disclosure 和保存反馈；“恢复全部自动值”必须先二次确认。
14. 在系统减少动态效果设置下检查无页面位移；320px、375px、430px 宽度均无横向滚动，固定纸张主题下文字对比清晰。

## 5. 审核资料要点

- **类目**：传统文化 / 工具类
- **内容说明**：离线六爻起卦与排盘记录工具，不提供在线 AI、不含社交/付费/广告功能，不含外链跳转。
- **免责声明**：应用内所有结果页固定展示"仅供传统文化研究与娱乐参考"，健康、法律、财务类问题有专门提示（见 `src/engines/interpretation/disclaimers.ts`）。
- **隐私说明**：见 `docs/privacy.md`——数据仅存于设备容器，无收集、无上传。

## 6. 版本记录

每次发版在 `src/domain/versions.ts` 更新 `engineVersion`，如数据结构变化需同步提升 `schemaVersion` 并在 `src/storage/migrations.ts` 添加迁移函数。
