#!/bin/bash
# Balendar 一键部署脚本
# 用法: ./deploy.sh "提交说明（请用中文）"

set -e

if [ -z "$1" ]; then
  echo "❌ 请提供提交说明，例如："
  echo "  ./deploy.sh \"修复了登录页面的样式问题\""
  exit 1
fi

echo "===== 1/5 提交代码到 GitHub ====="
cd "$(dirname "$0")"
git add .
git commit -m "$1"
git push

echo ""
echo "===== 2/5 服务器拉取代码 ====="
ssh root@8.137.166.216 "cd /root/Balendar && git pull"

echo ""
echo "===== 3/5 安装依赖 ====="
ssh root@8.137.166.216 "cd /root/Balendar && pnpm install"

echo ""
echo "===== 4/5 构建 ====="
ssh root@8.137.166.216 "cd /root/Balendar && pnpm --filter balendar-client run build && pnpm --filter balendar-server run build"

echo ""
echo "===== 5/5 重启服务 ====="
ssh root@8.137.166.216 "fuser -k 3000/tcp 2>/dev/null; cd /root/Balendar && NODE_ENV=production nohup pnpm --filter balendar-server run dev > /root/balendar.log 2>&1 &"
sleep 3

echo ""
echo "===== ✅ 部署完成！验证中... ====="
curl -s http://8.137.166.216:3000/api/health && echo ""
echo "🎉 访问: http://8.137.166.216:3000"
