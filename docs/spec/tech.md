# 技术方案

> 返回 [总览 plan.md](plan.md)

## 1. 与易学堂同一套

- **Vite + React + TypeScript**，hash 路由，单页应用。
- **motion**（`motion/react`）做页面切换、卡片、打卡、答题反馈；全局 `MotionConfig reducedMotion="user"`。
- **SVG** 画星盘、圆环、几何线；星空背景和粒子用 **Canvas 2D**。
- **存储**：
  - localStorage（键名如 `xingxue-v1`）存进度、打卡、温习盒、设置。
  - IndexedDB（用 `idb-keyval` 这类小库）存体积大的东西：讲解录音、案例笔记、预测日记、自建星盘。两年下来数据量会超过 localStorage 的约 5MB 上限。
  - 设置里提供"导出/导入备份"（一个 JSON + 录音打包成 zip），防止清缓存丢数据。
- **GitHub Pages** 部署：仓库如 `xingxue-tang`，`vite.config` 设 `base: '/xingxue-tang/'`，`main` 推送自动部署（照抄易学堂的 `deploy.yml`）。
- 不请求任何第三方资源；字体用系统字体；插图放 `public/art/*.webp`。
- **课程数据**：每阶段一个 TS 文件（`src/data/curriculum/stage01.ts` …… `stage17.ts`），按阶段懒加载。结构沿用易学堂并扩展：

```ts
type LessonKind = 'new' | 'practice' | 'case' | 'review';
interface Lesson {
  day: number;            // 1–700
  stage: number;          // 1–17
  kind: LessonKind;
  title: string;
  question: string;       // 本课问题
  screens: Screen[];      // 钩子/观察/推导/类比/例子/约定/互动/反事实/文献/连线/小结
  quiz: Quiz[];
  qa: QAEntry[];          // 本课新增问答
  links: ConceptLink[];   // 知识星网新增连线
  caseId?: string;        // 案例课对应的星盘
}
```

- **自检脚本** `npm run check`：
  - 天数 1–700 连续，每阶段天数与 [plan.md](plan.md) 一致。
  - 每节新课至少 3 题；每节新课至少有一张带"约定"或"争议"标签的屏（除非显式豁免）。
  - 题目选项不重复；推导题每一步都有答案。
  - 星网连线指向存在的概念；问答链接指向存在的课程屏。
  - 天文与占星计算的回归测试（见第 3 节）。

## 2. 天文计算

阶段 1 的动画主要是示意几何；从阶段 2 的"今天行星在哪"开始需要真实星历。

| 需求 | 方案 |
|---|---|
| 日月行星黄经、速度、逆行、留、月相、日月食、二分二至时刻、行星回归时刻 | **astronomy-engine**（MIT 许可，纯 JavaScript，无数据文件，精度约 1 角分）。体积约一百多 KB，用动态 `import()` 只在星图页和需要真实数据的课里加载 |
| 恒星时、上升、天顶 | 用 astronomy-engine 的恒星时，自己写公式：天顶 `tan λ = tan RAMC / cos ε`；上升 `tan λ = −cos RAMC / (sin ε · tan φ + cos ε · sin RAMC)`（注意象限） |
| 宫位制 | 自己实现整宫、等宫、波菲利、普拉西度、科赫、雷氏、坎帕纳斯；普拉西度和科赫在极圈内返回"无法计算"（这本身是教学点） |
| 赤纬、出界、映点 | 黄道→赤道坐标转换；映点 = 180° − λ |
| 尊贵 | 守护、入旺、三分（三套可选）、埃及界与托勒密界、十度（迦勒底与三分两套）表格；计分 |
| 特殊点 | 福点、精神点、赫尔墨斯七点等公式，日夜自动切换 |
| 月交点 | 平交点与真交点公式 |
| 恒星 | 常用亮星约 50 颗的历元坐标 + 岁差改正（astronomy-engine 支持自定义恒星） |
| 恒星黄道 | Lahiri 等常用岁差值，可选 |
| 小限、法达、黄道释放 | 纯算术，自己实现；法达交点位置、释放的摩羯 27 年按文献设置，可切换 |
| 次限推运、太阳弧、回归盘 | 用星历搜索功能找精确时刻；推运四轴提供几种算法 |
| 主限 | 自己实现：赤经、斜升、半弧；托勒密/普拉西度半弧法与雷氏法；时间钥匙（托勒密、奈伯德）可选。这是最复杂的模块，放在第 10 阶段前完成 |
| 卜卦考量 | 上升早晚、月亮空亡（几种定义）、燃烧途径、土星位置等自动检查 |
| 择日扫描 | 按条件逐分钟/逐 5 分钟扫描未来 N 天，在 Web Worker 里跑，避免界面卡顿 |
| 大会合、外行星周期、日月食列表 | 星历搜索 |
| 占星地图 | 对地球每个经度算行星上中天/上升的位置，画在简化世界地图（自带矢量数据）上 |
| 背景星空与星座连线 | 耶鲁亮星星表（公有领域）取 5 等以内约 1600 颗；星座连线和边界用 d3-celestial 数据（BSD 许可）；打包成精简 JSON |
| 天球投影 | 自己写正交投影（几十行）或用 d3-geo；不引入 three.js |
| 时区与历史夏令时 | 浏览器 `Intl` 的 IANA 时区数据；**中国 1986–1991 年夏令时**、1949 年前各地时区不统一，输入时提醒并允许手动校正 |
| 地点 | 不调在线地图；内置中国地级市和世界主要城市经纬度表，也可手动输入 |

**备选**：瑞士星历（Swiss Ephemeris）是占星软件的事实标准，有 WebAssembly 版本，但许可证是 AGPL 或商业授权，体积也大；先不用。如果以后需要与主流软件逐角秒一致，再评估。

## 3. 计算校验

- 天文：十几个已知值（如 2000-01-01 12:00 TT 太阳视黄经约 280.4°、若干年份的春分时刻、已知日月食时间）。
- 占星：几张 AA 级名人盘的上升、天顶、各宫位制宫头、福点、小限、法达、黄道释放、主限，与两款成熟软件的结果对比（黄经误差 < 0.1°，时间主星日期误差 < 1 天）。
- 写进 `npm run check`，每次改计算都跑。

## 4. 目录草图

```
src/
  App.tsx                路由、MotionConfig、底栏、页面切换
  index.css              设计系统
  data/
    curriculum/          stage01.ts … stage17.ts（懒加载）
    concepts.ts          知识星网
    qa/                  问答库（按阶段分文件）
    cases/               案例库（出生数据 + 来源 + 传记要点）
    tables/              尊贵表、界、十度、行星年数、恒星表
  lib/
    store.ts             进度、打卡、温习、设置（localStorage）
    db.ts                录音、笔记、日记、自建盘（IndexedDB）
    astro/               星历封装、四轴、宫位制、尊贵、特殊点
    timing/              行运、回归、推运、太阳弧、小限、法达、释放、主限
    horary.ts electional.ts mundane.ts
  workers/scan.worker.ts 择日扫描
  components/
    glyphs/              自绘星座、行星符号
    sky/                 天球、公转、倾角、岁差等动效
    wheel/               星盘、相位画线、宫位制变形、双盘
    timeline/            时间主星时间轴
    quiz/                各题型
    LearningMap.tsx StarWeb.tsx StarCalendar.tsx
  pages/                 Welcome、Today、Course、Stage、Lesson、Sky、Chart、Workbench、Atlas、Cases、Review、Journal、QA、Settings
scripts/selfcheck.ts
```

## 5. 制作顺序

1. **骨架**：设计系统、五个标签、课程引擎（四种课 + 屏幕类型 + 题型）、存储、打卡日历、学习地图、问答区。
2. **阶段 1 全部 42 课** + 阶段 1 动效 + 天空模拟器（接入 astronomy-engine）。这是第一个能每天用的版本，覆盖前 6 周。
3. **始终领先飞飞 4–6 周**：按阶段推进内容，每阶段上线前跑自检和截图审查（标准对齐易学堂的"高级感"要求）。
4. 第 5 阶段（第 169 天）前完成真实星盘（宫位制、时区、城市表）。
5. 第 10 阶段（第 400 天）前完成时间主星和主限模块。
6. 第 12–14 阶段前分别完成卜卦、择日、世俗工具。

每一步完成后部署到 GitHub Pages，飞飞边学边提意见。
