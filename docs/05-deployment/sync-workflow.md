# 本地开发 → 服务器部署同步流程

> 文档状态：[x] 定稿
> 最后更新：2026-06-10

---

## 一、前置条件

| 条件 | 说明 |
|------|------|
| SSH 免密登录 | 本地已配置 SSH 密钥，可免密连接 `root@8.137.166.216` |
| GitHub 仓库 | `https://github.com/NICHUSYNDROME/Balendar` |
| 服务器运行 | ECS (8.137.166.216), Node.js v22, Docker, PostgreSQL 运行中 |

---

## 二、完整同步流程

每次本地修改代码后，按以下步骤同步到服务器：

### 第 1 步：本地提交并推送到 GitHub

```bash
cd /Users/nichu/Balendar
git add .
git commit -m "🚀 本次修改的说明（请使用中文描述）"
git push
```

> **注意：message 必须使用中文描述修改内容。**

### 第 2 步：服务器拉取最新代码

```bash
ssh root@8.137.166.216 "cd /root/Balendar && git pull"
```

> ⚠️ 如果遇到 `Your local changes would be overwritten by merge` 冲突：
> ```bash
> ssh root@8.137.166.216 "cd /root/Balendar && git stash && git pull && git stash drop"
> ```

### 第 3 步：安装依赖（如果有新增依赖）

```bash
ssh root@8.137.166.216 "cd /root/Balendar && pnpm install"
```

### 第 4 步：重新构建

```bash
ssh root@8.137.166.216 "cd /root/Balendar && pnpm --filter balendar-client run build && pnpm --filter balendar-server run build"
```

### 第 5 步：重启服务

```bash
ssh root@8.137.166.216 "fuser -k 3000/tcp 2>/dev/null; cd /root/Balendar && NODE_ENV=production nohup node server/dist/src/index.js > /root/balendar.log 2>&1 &"
```

> ⚠️ **关键细节**：
> - 入口文件是 `server/dist/src/index.js`（不是 `server/dist/index.js`）——因为 tsconfig 的 `rootDir: "."` 导致编译输出多一层 `src/` 目录
> - `NODE_ENV=production` 必须和 `node` 命令在同一行，否则 `nohup` 不会传递该环境变量
> - 缺少 `NODE_ENV=production` 会导致前端页面 404（静态文件服务和 SPA fallback 不会注册）

### 第 6 步：验证部署

```bash
# 1. 健康检查
curl -s http://8.137.166.216:3000/api/health
# 期望: {"status":"ok",...}

# 2. 前端首页（应为 200，不是 404）
curl -s -o /dev/null -w 'HTTP %{http_code}' http://8.137.166.216:3000/
# 期望: HTTP 200

# 3. SPA 路由（前端路由应返回 index.html）
curl -s -o /dev/null -w 'HTTP %{http_code}' http://8.137.166.216:3000/login
# 期望: HTTP 200

# 4. 登录 API
curl -s http://8.137.166.216:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# 期望: {"data":{"token":"...","user":{...}}}

# 5. 演出 API（带 token）
TOKEN=$(curl -s -X POST http://8.137.166.216:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
curl -s http://8.137.166.216:3000/api/gigs -H "Authorization: Bearer $TOKEN"
# 期望: {"data":[...]}
```

> 如果第2步返回 404，通常是两个原因：① 没设置 `NODE_ENV=production`；② `__dirname` 相对路径算错了。

---

## 三、快捷命令（仅后端变更）

如果只改了后端代码（没有前端变化）：

```bash
git add . && git commit -m "🐛 修复了...（中文）" && git push
ssh root@8.137.166.216 "cd /root/Balendar && git pull && pnpm --filter balendar-server run build && fuser -k 3000/tcp 2>/dev/null; NODE_ENV=production nohup node server/dist/src/index.js > /root/balendar.log 2>&1 &"
```

## 四、数据库迁移（新增表时）

如果新增了 migration 文件：

```bash
ssh root@8.137.166.216 "cd /root/Balendar && pnpm --filter balendar-server run db:migrate"
```

> 迁移在构建之前运行也没关系——Knex 直接连数据库，不依赖编译产物。
ssh root@8.137.166.216 "fuser -k 3000/tcp 2>/dev/null; cd /root/Balendar && NODE_ENV=production nohup pnpm --filter balendar-server run dev > /root/balendar.log 2>&1 &"
```

---

## 四、快捷命令（仅前端变更）

```bash
git add . && git commit -m "💄 更新了...（中文）" && git push
ssh root@8.137.166.216 "cd /root/Balendar && git pull && pnpm --filter balendar-client run build"
ssh root@8.137.166.216 "fuser -k 3000/tcp 2>/dev/null; cd /root/Balendar && NODE_ENV=production nohup pnpm --filter balendar-server run dev > /root/balendar.log 2>&1 &"
```

---

## 五、首次部署参考

如果需要在全新服务器上部署，步骤详见 `./infra-setup.md`。

---

## 六、注意事项

1. **数据库迁移**：如果新增了数据库表（新增 migration 文件），在第 4 步之前需要先执行：
   ```bash
   ssh root@8.137.166.216 "cd /root/Balendar/server && npx knex migrate:latest --knexfile knexfile.ts"
   ```

2. **种子数据**：如果需要重新初始化测试数据：
   ```bash
   ssh root@8.137.166.216 "cd /root/Balendar/server && npx knex seed:run --knexfile knexfile.ts"
   ```

3. **查看服务器日志**：
   ```bash
   ssh root@8.137.166.216 "tail -50 /root/balendar.log"
   ```

4. **Git 提交 message 必须使用中文**，方便后续追溯和理解。
