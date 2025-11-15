# GitHub Pages 部署指南

## 🚀 快速部署步骤

### 1️⃣ 创建 GitHub 仓库

1. 登录 https://github.com
2. 点击右上角的 "+" → "New repository"
3. 仓库名称填写：`multi-color-relief`
4. 描述填写：`Layer-by-layer multi-color relief tool for 3D printing`
5. 选择 "Public"（公开仓库才能用免费的 GitHub Pages）
6. **不要勾选** "Add a README file"
7. 点击 "Create repository"

### 2️⃣ 上传代码到 GitHub

在终端（Terminal）中，进入项目目录并运行：

```bash
# 初始化 git 仓库
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: Multi-color relief tool for 3D printing"

# 设置主分支名称
git branch -M main

# 连接到你的 GitHub 仓库（替换 你的用户名）
git remote add origin https://github.com/你的用户名/multi-color-relief.git

# 推送到 GitHub
git push -u origin main
```

### 3️⃣ 启用 GitHub Pages

1. 在 GitHub 仓库页面，点击 "Settings"（设置）
2. 在左侧菜单找到 "Pages"
3. 在 "Build and deployment" 部分：
   - **Source** 选择：`GitHub Actions`
4. 页面会自动保存

### 4️⃣ 等待部署完成

1. 点击仓库顶部的 "Actions" 标签
2. 你会看到一个名为 "Deploy to GitHub Pages" 的工作流正在运行
3. 等待绿色的 ✓ 出现（大约 2-3 分钟）

### 5️⃣ 访问你的网站

部署成功后，你的网站地址是：

```
https://你的用户名.github.io/multi-color-relief/
```

## 🔄 更新网站

以后如果修改了代码，只需要：

```bash
git add .
git commit -m "更新说明"
git push
```

GitHub Actions 会自动重新构建和部署！

## ❓ 常见问题

### Q: 404 Not Found？

A: 等待 5-10 分钟，GitHub 需要时间来部署。刷新几次试试。

### Q: 如何修改仓库名称？

A: 如果你的仓库名称不同，需要修改 `vite.config.ts` 中的 base 路径：

```typescript
base: mode === 'production' ? '/你的仓库名/' : '/',
```

### Q: 可以用自己的域名吗？

A: 可以！在仓库的 Settings → Pages → Custom domain 中设置你的域名。

### Q: 部署失败？

A: 检查 Actions 标签页中的错误日志，确保所有文件都已正确提交。

## 💰 费用

**完全免费！** GitHub Pages 对公开仓库免费提供：
- 免费托管
- 免费域名（.github.io）
- 每月 100GB 流量
- 无需信用卡

## 🎉 完成！

现在你的 Multi-Color Relief 应用已经在线了，可以分享给任何人使用！
