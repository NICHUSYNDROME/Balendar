# 区块3：内容协作 — 开发计划

> 当前阶段：🚧 计划中
> 目标：完成歌曲库 + Setlist 编辑器 + 留言板
> 预计：6/10 ~ 6/13

---

## 任务 3.1 — 歌曲库（1天）

### 后端
- **新建** `server/src/db/migrations/006_create_songs.ts`
  - 字段: id(uuid), name(varchar), artist(varchar), original_key(varchar)
- **新建** `server/src/routes/songs.ts`
  - `GET /api/songs` — 列表+搜索 (?q=keyword, ILIKE name/artist)
  - `POST /api/songs` — admin/manager
  - `PUT /api/songs/:id` — admin/manager
  - `DELETE /api/songs/:id` — admin/manager
- **修改** `server/src/index.ts` — 注册 songs 路由

### 前端
- **新建** `client/src/pages/Songs.tsx`
  - 歌曲列表（表格/卡片）
  - 搜索框
  - 创建/编辑表单（弹窗或内联）
  - 权限控制: admin/manager 显示操作按钮
- **修改** `client/src/App.tsx` — 添加 `/songs` 路由

---

## 任务 3.2 — Setlist 编辑器（1.5天）

### 后端
- **修改** `server/src/routes/gigs.ts`
  - 新增 `PUT /api/gigs/:id/setlist`
  - Zod schema 校验 SetlistItem 类型（song/break/game）
  - admin/manager 权限

### 前端
- **新建** `client/src/components/SetlistEditor.tsx`
  - 显示当前 setlist 项列表
  - 从歌曲库搜索添加
  - 手动输入（曲名+歌手+调）
  - 拖拽排序
  - break/game 类型插入
  - 调号编辑 + 转调说明
  - 保存按钮
- **修改** `client/src/pages/GigDetail.tsx`
  - 集成 SetlistEditor（tab 切换或 section）

---

## 任务 3.3 — 留言板（1.5天）

### 后端
- **新建** `server/src/db/migrations/007_create_gig_messages.ts`
  - 字段: id(uuid), gig_id(uuid FK), user_id(uuid FK), content(text), images(jsonb), created_at(timestamptz)
- **新建** `server/src/routes/messages.ts`
  - `GET /api/gigs/:id/messages` — 列表（倒序）
  - `POST /api/gigs/:id/messages` — 参与者/manager/admin
  - `DELETE /api/gigs/:id/messages/:msgId` — 本人/admin
- **修改** `server/src/index.ts` — 注册 messages 路由

### 前端
- **新建** `client/src/components/GigMessages.tsx`
  - 留言列表（倒序，最新在底部）
  - 发送表单（文字+图片）
  - 删除按钮（本人/admin）
- **修改** `client/src/pages/GigDetail.tsx`
  - 集成 GigMessages 组件

---

## 部署验证流程
1. 本地 `pnpm dev` 验证
2. `./deploy.sh "完成了区块3：歌曲库+Setlist编辑器+留言板"`
3. curl 测试各 API 端点
4. 浏览器验证前端页面
