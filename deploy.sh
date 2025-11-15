#!/bin/bash

# Multi-Color Relief - GitHub 部署脚本
# Layer-by-layer multi-color relief tool for 3D printing

echo "🚀 开始部署 Multi-Color Relief 到 GitHub..."
echo ""

# 检查是否已经初始化 git
if [ ! -d .git ]; then
    echo "📦 初始化 Git 仓库..."
    git init
fi

# 添加所有文件
echo "📝 添加文件..."
git add .

# 提交
echo "💾 提交更改..."
git commit -m "Initial commit: Multi-color relief tool for 3D printing"

# 设置主分支
echo "🌿 设置主分支..."
git branch -M main

# 提示用户输入 GitHub 用户名
echo ""
read -p "请输入你的 GitHub 用户名: " username

# 检查是否已经添加了 remote
if git remote | grep -q "origin"; then
    echo "🔗 更新远程仓库地址..."
    git remote set-url origin https://github.com/$username/multi-color-relief.git
else
    echo "🔗 添加远程仓库..."
    git remote add origin https://github.com/$username/multi-color-relief.git
fi

# 推送到 GitHub
echo "⬆️  推送到 GitHub..."
git push -u origin main

echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 接下来的步骤："
echo "1. 访问 https://github.com/$username/multi-color-relief/settings/pages"
echo "2. 在 'Build and deployment' 下，Source 选择 'GitHub Actions'"
echo "3. 等待 2-3 分钟后访问："
echo "   👉 https://$username.github.io/multi-color-relief/"
echo ""
