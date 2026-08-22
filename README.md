# 足球数据变现工具箱（演示原型）

把「数据分析与可视化」变成可交付价值的三个原型，对应前文提到的三条收入路径：
**内容自媒体（看板配图）· 工具与产品（小程序）· 合规竞彩分析（复盘模板）**。

> ⚠️ 所有比赛、球队、球员与数据均为**虚构示例**，仅用于演示，与任何真实赛事无关。
> 「竞彩复盘」仅作数据研究演示，**不构成任何购彩建议**；请理性购彩、遵守所在地法律法规。

## 本次升级（第二批）

1. **真实数据接口**：新增 `assets/api.js` 可插拔数据层。`app.html` 的赛事列表改走
   `FB.api.listMatches()`，默认用内置示例（离线可用），在「数据源设置」中可切换为
   **OpenLigaDB（德甲真实数据，免费无需 Key）** 或 **football-data.org（需 API Key）**，
   并提供「测试连接」。免费接口不含 xG/射门坐标等高级指标，高级可视化仍以示例数据演示。
2. **球员榜 / 球员热图**：`app.html` 新增「球员榜」（射手榜/助攻榜/xG 榜切换、点击进详情）
   与「球员活动热图」（球场位置热力图），数据见 `assets/data.js` 的 `FB.PLAYERS`。
3. **复盘模板导出 PDF**：`review.html` 右上角「导出 PDF」按钮 + 打印专用页眉（付费版标识/生成时间）
   + `@media print` 样式，浏览器打印即可存为 PDF，作为付费产品交付物。

## 本次升级（第三批）

1. **接入真实高级数据源（API-Football）**：`assets/api.js` 新增 `api_football` provider
   （api-sports.io，需 Key）。与 OpenLigaDB / football-data.org 不同，它返回**真实 xG、球队统计、
   射门事件**。小程序「赛事中心」切到该源后，点击任意比赛即可在详情里看到由真实接口拼出的
   数据快照（`stats` / `xG` / 射门数）。映射函数 `mapApiFootballList` / `mapApiFootballMatch`
   已写好，新增其它高级源照此格式加一个 provider 即可，页面无需改动。
2. **复盘 PDF 加水印 + 付费二维码**：`review.html` 导出 PDF 时自动带上
   **联赛名水印（铺底大字、每页重复）+ 付费版角标**，打印页眉生成**验证/购买二维码**
   （`assets/qrcode.min.js`，纯本地生成，无外部依赖）。报告即一份带品牌、合规提示完整的付费交付物。
3. **部署为可分享在线站点**：整个工具箱已部署到 CloudStudio，获得可分享链接，任何人打开即可用
   （含迷你小程序、看板、复盘模板）。设置真实数据源（如 API-Football Key）后，线上站点即拉真实数据。

## 文件结构

```
football-money-kit/
├── index.html          # 总览入口（三件原型导航 + 变现路径回顾）
├── dashboard.html      # ① 比赛数据可视化看板
├── review.html         # ② 合规竞彩复盘模板（可导出 PDF · 水印/二维码）
├── app.html            # ③ 迷你足球数据小程序（球员榜/热图 + 真实接口切换）
├── assets/
│   ├── style.css       # 共享样式（浅色主题 + 打印规则/水印）
│   ├── data.js         # 共享数据层（赛事/复盘/比赛列表/球员 + 传球网络/热区生成器）
│   ├── api.js          # 可插拔数据接口层（mock / OpenLigaDB / football-data.org / API-Football）
│   └── qrcode.min.js   # 二维码生成库（本地，用于复盘 PDF 付费二维码）
```

## 快速开始

直接用浏览器打开 `index.html`（或访问已部署的分享链接）即可（推荐 Chrome / Edge）。

- **小程序（`app.html`）默认连接 OpenLigaDB 德甲真实数据**：打开「赛事中心」即看到真实赛程/比分，
  点任意比赛看真实球队与比分详情（无需 Key）。这是零门槛看真实比赛的方式。
- **进阶真实数据**：在「数据源设置」切到 `API-Football` 并填入 Key，比赛详情即展示真实 xG、统计与射门。
- 看板与复盘页使用 [ECharts](https://echarts.apache.org/)（CDN 加载），**首次打开需联网**。
- 小程序骨架与球场 SVG 为纯本地渲染，离线可用（离线时赛事列表自动回退到内置示例）。

## 各原型能力

### ① dashboard.html — 比赛可视化看板
- 比分头图（含 xG）
- 球队核心数据对比条
- xG 累积时间线（折线）
- 射门分布图（SVG 球场 + 坐标打点，点大小= xG，颜色=球队）
- 传球网络（4-3-3，可切换主/客队，连线粗细=传球量）
- 活动热区（12×7 网格热力图，可切换主/客队）

### ② review.html — 合规竞彩复盘模板
- 四段式复盘结构（基本面 / 数据面 / 盘口面 / 模型结论）
- 数据字段 schema（可直接对接接口/数据库）
- 近 10 场战绩（胜平负堆叠）
- 历史交锋（主胜/平/客胜）
- 让球盘路（单场赢盘 + 累计命中率）
- 多处理性购彩合规提示

### ③ app.html — 迷你足球数据小程序骨架
- 侧边导航：赛事中心 / 球队库 / 球员榜 / 竞彩复盘 / 设置
- 赛事中心：联赛筛选 + 比赛卡片列表
- 点击卡片进入详情（示例场次联动完整看板，其余为占位）
- 预留数据层，可接真实数据源迭代成产品

## 如何接真实数据

数据层已拆分为两层：

- **`assets/data.js`（`FB`）**：示例数据集与本地生成器（`FB.MATCH` / `FB.REVIEW` / `FB.MATCHES` / `FB.PLAYERS`，
  `buildPassNetwork` / `buildHeatmap` / `buildPlayerHeatmap`）。
- **`assets/api.js`（`FB.api`）**：统一取数接口，页面只调用 `FB.api.listMatches()` / `FB.api.getMatch()`，
  内部按「数据源设置」选择 provider：
  - `mock`：内置示例（默认，离线可用）
  - `openligadb`：OpenLigaDB 德甲真实数据（免费、无需 Key、支持浏览器 CORS）
  - `football-data.org`：需在该官网注册获取 API Key
  - `api_football`：**API-Football / api-sports.io（高级源，需 Key）**，可返回真实 xG、球队统计、射门事件；
    点击比赛详情即可看到由真实接口拼出的数据快照

接入真实数据时，只需在 `FB.api.providers` 里新增一个 provider 并写好响应映射函数
（参考已有的 `mapOpenLiga` / `mapFootballData` / `mapApiFootballList` / `mapApiFootballMatch`），
页面无需改动即可切换到新数据源。

> 已知限制（诚实说明）：API-Football 的 `fixtures/events` **不含球场坐标**，因此射门在球场上的
> x/y 位置为按球队进攻方向估算的「近似坐标」（页面已标注）；xG 与各项统计为真实数据。
> 若需真实射门坐标 / 传球网络，可接入 StatsBomb Open Data 等付费/开放高级源，照上述格式加 provider 即可。

### 部署为在线站点

整个目录是纯静态站点，可直接托管到任意静态服务器 / CloudStudio / GitHub Pages。
- 入口 `index.html`，已部署示例见分享链接（部署时生成）。
- 注意：看板与复盘页依赖 ECharts CDN，线上打开需联网；小程序骨架与球场 SVG 离线可用。
- 切换真实数据源在「小程序 → 数据源设置」里填 Key，保存后到「赛事中心」即拉真实数据（跨域需数据源支持 CORS）。
