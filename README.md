# 小狗家的拼图

一个本地运行的儿童拼图游戏，适合低龄孩子在电脑浏览器里玩。游戏支持从本地图片库选择图片、上传新图片、切换拼图大小，并提供底图、提示、纠错、粘合、音效和连续下一张等模式。

> 本项目仅用于本地个人游玩和学习。请确认你放入 `images/` 的图片拥有合适的使用权限；本仓库默认不会提交本地图片素材。

## 功能

- 图片列表：从 `images/` 文件夹加载本地图片，左侧可滚动预览和选择。
- 上传图片：页面内上传图片后会保存到 `images/` 文件夹，并立即加入图片列表。
- 拼图大小：支持 `2x2`、`3x3`、`4x4`、`5x5`。
- 自适应比例：拼图区按原图比例显示，避免图片被拉伸变形。
- 底图与提示：可显示/隐藏底图，也可以逐格添加提示。
- 纠错模式：开启时只能放到正确位置；关闭时允许自由摆放和互换。
- 粘合模式：相邻且正确拼在一起的块会自动粘合，之后可作为整体拖动。
- 状态保存：浏览器刷新后会保留当前图片、设置和每张图片的拼图进度。
- 完成反馈：拼好后可选择“再看看”或“下一张”。

## 目录

```text
.
├── index.html              # 页面入口
├── styles.css              # 布局和视觉样式
├── dev-server.js           # 本地图片服务和静态文件服务
├── game.js                 # 游戏主流程
├── game-*.js               # 拆分后的游戏模块
├── glue-groups.js          # 粘合组逻辑
├── image-analysis.js       # 相似块分析
├── verify-browser.js       # 浏览器回归测试
├── images/.gitkeep         # 本地图片目录占位
└── docs/                   # 设计和开发计划记录
```

## 启动

需要安装 Node.js。项目不需要 `npm install`，直接运行本地服务即可。

```powershell
node dev-server.js
```

启动后打开：

```text
http://localhost:4173/
```

如需换端口：

```powershell
$env:PORT=54887
node dev-server.js
```

## 添加图片

有两种方式：

1. 在页面点击“上传图片”。
2. 直接把图片文件放入 `images/` 文件夹，然后刷新页面。

支持常见图片格式：`png`、`jpg`、`jpeg`、`gif`、`webp`、`svg`。单次上传大小限制为 10MB。

`images/` 目录默认被 `.gitignore` 忽略，只保留 `images/.gitkeep`，这样可以避免把本地素材或版权图片推到远端仓库。

## 测试

基础逻辑测试：

```powershell
node --test game-logic.test.js
```

语法检查：

```powershell
node --check game.js
node --check game-drag.js
node --check verify-browser.js
```

浏览器回归测试需要本机可用的 Playwright/Chrome 环境：

```powershell
node verify-browser.js
```

当前布局以桌面浏览器优先。移动端验证如果在很窄视口下失败，通常需要单独调整移动端布局阈值。

## Git 和远端

初始化远端后，可以按 GitHub 提示添加远端并推送：

```powershell
git remote add origin <你的 GitHub 仓库地址>
git push -u origin main
```

