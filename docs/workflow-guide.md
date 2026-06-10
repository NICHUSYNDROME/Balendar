# Balendar 开发工作流程指南

> 文档状态：[x] 定稿
> 最后更新：2026-06-10
> 所有参与本项目的开发者/Agent 必须遵循此流程。

---

## 核心原则

1. **🧩 小步开发** — 每次只做计划中的一个任务，不要跨任务
2. **✅ 及时验证** — 每个任务完成后立即用 curl/浏览器验证
3. **📝 更新进度** — 验证通过后立刻更新 `docs/00-INDEX.md`
4. **🔄 频繁部署** — 按 `docs/05-deployment/sync-workflow.md` 同步到服务器

---

## 标准工作循环

```
① 阅读计划 → ② 执行开发 → ③ 本地验证 → ④ 更新进度 → ⑤ 提交部署 → ⑥ 确认
```

### 第 1 步：阅读计划

| 文档 | 用途 |
|------|------|
| `docs/00-INDEX.md` | 查看"实施进度追踪 🚀"表格，了解当前进度和下一步 |
| `docs/03-development/chunk-plan.md` | 查看当前任务的范围、依赖、预估工时、验收条件 |
| `docs/02-features/*.md` | （按需）查看对应区块的功能说明和 API 设计 |
| `docs/01-architecture/database-schema.md` | （按需）查看数据库表结构 |

### 第 2 步：执行开发

- 严格按照 `chunk-plan.md` 中**当前任务的范围**开发
- 不要超出当前任务范围
- 使用 `manage_todo_list` 工具跟踪子任务进度

### 第 3 步：本地验证

**后端 API 测试：**
```bash
# 确保本地服务器运行中（pnpm dev）
curl -s http://localhost:3000/api/health

# 测试具体接口（以登录为例）
curl -s http://localhost:3000/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**前端验证：** 打开浏览器访问 http://localhost:5173

**越权测试（重要！）：**
- 每次新增 API 都要用 admin/manager/musician 三种角色测试
- 非 admin 访问 admin 接口 → 期望 403

### 第 4 步：更新进度

编辑 `docs/00-INDEX.md`：
- 当前任务 `⬜ 待开始` → `✅ 完成`
- "说明"列补充具体交付内容
- 下一个任务改为 `🔄 进行中`

### 第 5 步：提交 & 部署

```bash
# 提交到 GitHub（message 必须用中文）
git add .
git commit -m "🚀 完成了XX功能（请用中文描述）"
git push

# 部署到服务器（详见 sync-workflow.md）
```

### 第 6 步：确认

询问用户："确认通过了吗？" 得到确认后再继续下一步。

---

## 任务状态标记规则

| 标记 | 含义 |
|------|------|
| ⬜ 待开始 | 尚未开始 |
| 🔄 进行中 | 正在开发中 |
| ✅ 完成 | 已开发完成并验证通过 |

---

## 区块与任务对照

### 区块1：用户认证 + 角色 + 多日历 ✅ 已完成
| 任务 | 说明 |
|------|------|
| 1.1 项目脚手架搭建 | server(Fastify) + client(React+Vite)，pnpm dev 同时启动 |
| 1.2 数据库初始化 | Docker Compose + PostgreSQL + Knex + 3张表 + 种子数据 |
| 1.3 登录接口 | JWT 签发/验证，POST /api/auth/login + GET /api/auth/me |
| 1.4 用户 CRUD | GET/POST/PATCH/DELETE /api/users，admin 权限保护 |
| 1.5 日历 CRUD + 成员管理 | 日历增删改查 + 成员添加/移除 + 权限控制 |
| 1.6 前端登录 + 日历 | 登录页、日历列表、日历详情/编辑/成员管理 |

### 区块2：演出管理 + 参与者 + 行级权限 ⭐
| 任务 | 状态 | 说明 |
|------|------|------|
| 2.1 演出 CRUD | ⬜ 待开始 | gigs 表 migration + 后端 API + 前端 FullCalendar |
| 2.2 行级权限过滤 | ⬜ 待开始 | 按角色过滤 gigs，三种角色查询不同结果 |
| 2.3 参与者管理 | ⬜ 待开始 | gig_participants 表 + 参与者增删 API |
| 2.4 前端演出管理 | ⬜ 待开始 | FullCalendar 集成 + 演出详情/编辑表单 |
| 2.5 前端权限适配 | ⬜ 待开始 | 根据角色隐藏/禁用编辑按钮 |

---

## 重要约定

1. **Git commit message 必须使用中文** 🇨🇳
2. **服务器信息**：IP `8.137.166.216`，免密 SSH: `ssh root@8.137.166.216`
3. **一键部署**：`./deploy.sh "中文说明"`
4. **避免大范围修改**：每个任务只改相关文件
5. **及时记录**：验证通过后立即更新进度，不要等
6. **越权测试不可少**：每次新增 API 都要测试三种角色

---

## ⚠️ 常见踩坑与解决方案（实战教训）

> 以下内容来自区块2部署实战中反复试错总结，提前知晓可节省大量时间。

### 坑1：编译后的入口文件路径 ≠ 源码路径

**现象**：`node server/dist/index.js` 启动后，新增的路由全部 404。

**根因**：`server/tsconfig.json` 配置了 `"rootDir": "."` + `"include": ["src/**/*"]`，导致源码文件 `src/index.ts` 被编译到 `dist/src/index.js`，而 `dist/index.js` 是从根目录的 `knexfile.ts` 编译出来的，不含路由注册。

```
源码结构                  编译输出
src/index.ts          →   dist/src/index.js    ← ✅ 正确的服务器入口
src/routes/gigs.ts    →   dist/src/routes/gigs.js
knexfile.ts           →   dist/index.js        ← ❌ 不含路由！
```

**正确做法**：始终用 `node server/dist/src/index.js` 启动生产服务器。

**永久修复**（可选）：修改 `tsconfig.json` 的 `rootDir` 为 `"src"`，让输出结构扁平化。但需要同步调整 `knexfile.ts` 的位置和所有相对路径引用。

---

### 坑2：编译后的 __dirname 会改变相对路径

**现象**：生产环境前端页面返回 404，但 `client/dist/` 目录确实存在。

**根因**：源码中 `path.join(__dirname, '../../client/dist')` 在开发环境（`tsx watch` 直接运行 `.ts` 文件）时正确，因为 `__dirname` = `.../server/src/`，`../../client/dist` = `.../client/dist` ✅。

但编译后从 `dist/src/index.js` 运行时，`__dirname` = `.../server/dist/src/`，`../../client/dist` = `.../server/client/dist` ❌ 不存在！

```
开发环境 (tsx):  server/src/        → ../../client/dist  =  client/dist  ✅
生产环境 (node): server/dist/src/   → ../../client/dist  =  server/client/dist  ❌
生产环境 (node): server/dist/src/   → ../../../client/dist = client/dist  ✅
```

**正确做法**：按编译后的 `__dirname` 计算相对层级，需要多一层 `../`。部署后立即用 `curl -o /dev/null -w 'HTTP %{http_code}' http://IP:3000/` 验证。

---

### 坑3：nohup 启动不继承 shell 环境变量

**现象**：服务器日志显示 `Route GET:/ not found`，静态文件未注册。

**根因**：`server/src/index.ts` 中用 `if (process.env.NODE_ENV === 'production')` 控制静态文件服务和 SPA fallback。但在远程执行 `nohup node server/dist/src/index.js > log 2>&1 &` 时，如果不在同一行声明 `NODE_ENV=production`，该变量不会被传递。

```bash
# ❌ 错误：NODE_ENV 未传递给 node 进程
ssh root@IP "cd /root/Balendar && NODE_ENV=production"
ssh root@IP "cd /root/Balendar && nohup node server/dist/src/index.js &"

# ✅ 正确：NODE_ENV 与 node 命令在同一行
ssh root@IP "cd /root/Balendar && NODE_ENV=production nohup node server/dist/src/index.js > /root/balendar.log 2>&1 &"
```

**正确做法**：`NODE_ENV=production` 必须和 `node` 命令写在同一条语句中。

---

### 坑4：服务器 git pull 可能因本地修改冲突

**现象**：`git pull` 报 `Your local changes would be overwritten by merge`。

**根因**：服务器上可能有人之前手动修改过文件（调试、修补等），这些未提交的改动与远程仓库冲突。

**正确处理**：
```bash
ssh root@8.137.166.216 "cd /root/Balendar && git stash && git pull && git stash drop"
```

> `git stash drop` 丢弃服务器的临时修改，以 GitHub 上的代码为准。

---

### 坑5：FullCalendar v6 不需要单独导入 CSS 文件

**现象**：花时间查找 `@fullcalendar/core/main.css` 等文件，但不存在。

**根因**：FullCalendar v6 使用 CSS-in-JS 方案，样式在 JS 加载时自动注入 DOM，无需手动导入任何 `.css` 文件。只需要导入 JS 插件和语言包即可：

```ts
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import '@fullcalendar/core/locales/zh-cn';  // 中文本地化
// 无需任何 CSS import！
```

---

### 坑6：浏览器交互工具 click_element 容易超时

**现象**：`click_element` 工具频繁超时（Timeout 10000ms），无法点击页面按钮。

**根因**：该工具对元素的 `visible/enabled/stable` 状态检查非常严格，React 组件在状态切换时的短暂重渲染也可能触发超时。

**替代方案**（按优先级）：
1. **`navigate_page`** — 如果目标是跳转到已知 URL，直接导航比点击快得多
2. **`run_playwright_code` + `{ force: true }`** — 绕过可见性检查：
   ```js
   await page.locator('button', { hasText: '编辑' }).click({ force: true });
   ```
3. **`run_playwright_code` + `page.evaluate`** — 直接读取页面文本验证状态，不依赖点击

---

### 坑7：多终端输出混杂难以排查

**现象**：多个 `ssh` 或 `curl` 命令的输出在同一终端中交替出现，难以分辨哪个是当前命令的结果。

**应对策略**：
1. 每次验证用独立的新命令，带上明确的 `echo "=== 标签 ==="` 分隔
2. 注意日志中的 **PID**（进程ID），不同启动对应不同 PID
3. 怀疑服务器状态时，直接查看最新日志：`ssh root@IP "tail -5 /root/balendar.log"`
4. 用 `curl -o /dev/null -w 'HTTP %{http_code}'` 只输出状态码，避免响应体干扰

---

### 部署前检查清单 ☑️

每次部署前，确认以下事项可避免大部分问题：

- [ ] `git status` 确认所有更改已提交
- [ ] 服务器入口：确认用 `dist/src/index.js` 而非 `dist/index.js`
- [ ] 静态文件路径：确认 `__dirname` + 相对路径指向正确的 `client/dist/`
- [ ] 环境变量：`NODE_ENV=production` 和 `node` 命令在同一行
- [ ] 新增依赖：服务器已执行 `pnpm install`
- [ ] 数据库迁移：服务器已执行 `pnpm run db:migrate`
- [ ] 前后端均构建：`build` 命令对 client 和 server 都执行了
- [ ] 部署后验证：`curl` 测试 `/api/health`、`/`、`/api/gigs` 三个端点
