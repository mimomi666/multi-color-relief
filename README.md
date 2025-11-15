# Multi-Color Relief

**Layer-by-layer multi-color relief tool for 3D printing**

Convert images into multi-color 3D print models with drag-and-drop color layer reordering and customization.

将图片转换为多色3D打印模型，支持拖拽调整颜色顺序和自定义颜色。

## 在线访问 / Online Access

部署后的网址：`https://你的用户名.github.io/multi-color-relief/`

## 本地运行

**前置要求：** Node.js 18+

1. 安装依赖：
   ```bash
   npm install
   ```

2. 启动开发服务器：
   ```bash
   npm run dev
   ```

3. 在浏览器中打开 http://localhost:3000

## 部署到 GitHub Pages

### 步骤 1：创建 GitHub 仓库

1. 在 GitHub 上创建一个新仓库，名称为 `hueforge-web_-color-relief-3d-models`
2. 不要初始化 README、.gitignore 或 license

### 步骤 2：上传代码

在项目目录中运行：

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/hueforge-web_-color-relief-3d-models.git
git push -u origin main
```

### 步骤 3：启用 GitHub Pages

1. 进入仓库的 Settings（设置）
2. 点击左侧的 "Pages"
3. 在 "Build and deployment" 下：
   - Source 选择：**GitHub Actions**
4. 等待几分钟，GitHub Actions 会自动构建和部署

### 步骤 4：访问你的网站

部署完成后，访问：`https://你的用户名.github.io/hueforge-web_-color-relief-3d-models/`

## 功能特点

- 🎨 K-Means 颜色聚类（2-16色）
- 🖱️ 拖拽调整图层顺序
- 🎨 自定义每层颜色
- 🔍 边缘保护（保留细节）
- 📏 自动计算累积打印高度
- 📦 导出 STL 文件用于3D打印

## 技术栈

- React 19 + TypeScript
- Three.js + @react-three/fiber
- Vite
- Floyd-Steinberg 抖动算法
- Sobel 边缘检测
