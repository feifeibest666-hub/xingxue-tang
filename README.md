# 星学堂 · 西方占星从零学

每天 20 分钟、700 天、17 个阶段：从天文和几何讲起的西方占星课。手机优先，纯前端，数据只存在本机（localStorage）。

在线地址：https://feifeibest666-hub.github.io/xingxue-tang/

- 第 1 阶段「天空的几何」42 课已完整上线（推导、类比、互动、小题、问答）；其余 16 个阶段的课表可浏览，内容陆续补上。
- 技术：Vite + React + TypeScript + motion，astronomy-engine 按需加载做真实星历。无第三方请求、无外部字体。

```bash
npm install
npm run dev       # 本地开发
npm run check     # 内容与天文计算自检
npm run build     # 类型检查 + 打包到 dist/
npm run outline   # 从 docs/spec/stages/*.md 重新生成 src/data/outline.ts
```

推送到 `main` 会通过 `.github/workflows/deploy.yml` 自动部署到 GitHub Pages。
