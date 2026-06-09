import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getAuthUser, requireAdmin } from '../lib/auth';

const createCalendarSchema = z.object({
  name: z.string().min(1, '日历名称不能为空').max(128),
});

const updateCalendarSchema = z.object({
  name: z.string().min(1).max(128),
});

// 检查用户是否是日历的管理员成员
async function isCalendarManager(
  app: FastifyInstance,
  calendarId: string,
  userId: string,
): Promise<boolean> {
  const member = await app.knex('calendar_members')
    .where({ calendar_id: calendarId, user_id: userId })
    .first();
  return !!member;
}

export async function calendarRoutes(app: FastifyInstance) {
  // ==================== 日历 CRUD ====================

  // GET /api/calendars — 日历列表
  app.get('/api/calendars', async (request, reply) => {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    let calendars;
    if (authUser.role === 'admin') {
      // admin 看全部
      calendars = await app.knex('calendars')
        .select('*')
        .orderBy('created_at', 'asc');
    } else {
      // manager/musician 看有关联的
      calendars = await app.knex('calendars')
        .select('calendars.*')
        .leftJoin('calendar_members', 'calendars.id', 'calendar_members.calendar_id')
        .where('calendars.owner_id', authUser.sub)
        .orWhere('calendar_members.user_id', authUser.sub)
        .groupBy('calendars.id')
        .orderBy('calendars.created_at', 'asc');
    }

    return { data: calendars };
  });

  // POST /api/calendars — 创建日历（admin）
  app.post('/api/calendars', async (request, reply) => {
    const authUser = await requireAdmin(request, reply);
    if (!authUser) return;

    const parsed = createCalendarSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: '参数错误',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const [calendar] = await app.knex('calendars')
      .insert({
        name: parsed.data.name,
        owner_id: authUser.sub,
      })
      .returning('*');

    return reply.status(201).send({ data: calendar });
  });

  // GET /api/calendars/:id — 日历详情
  app.get('/api/calendars/:id', async (request, reply) => {
    const authUser = getAuthUser(request);
    if (!authUser) return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });

    const { id } = request.params as { id: string };

    const calendar = await app.knex('calendars').where({ id }).first();
    if (!calendar) return reply.status(404).send({ error: '日历不存在' });

    // 检查权限：admin 或日历成员或 owner
    if (authUser.role !== 'admin' && calendar.owner_id !== authUser.sub) {
      const isMember = await isCalendarManager(app, id, authUser.sub);
      if (!isMember) return reply.status(403).send({ error: '无权访问此日历' });
    }

    return { data: calendar };
  });

  // PUT /api/calendars/:id — 更新日历
  app.put('/api/calendars/:id', async (request, reply) => {
    const authUser = getAuthUser(request);
    if (!authUser) return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });

    const { id } = request.params as { id: string };

    const calendar = await app.knex('calendars').where({ id }).first();
    if (!calendar) return reply.status(404).send({ error: '日历不存在' });

    // admin 或日历 manager 可更新
    if (authUser.role !== 'admin') {
      const isManager = await isCalendarManager(app, id, authUser.sub);
      if (!isManager && calendar.owner_id !== authUser.sub) {
        return reply.status(403).send({ error: '无权编辑此日历' });
      }
    }

    const parsed = updateCalendarSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: '参数错误',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const [updated] = await app.knex('calendars')
      .where({ id })
      .update({ name: parsed.data.name })
      .returning('*');

    return { data: updated };
  });

  // DELETE /api/calendars/:id — 删除日历（admin）
  app.delete('/api/calendars/:id', async (request, reply) => {
    const authUser = await requireAdmin(request, reply);
    if (!authUser) return;

    const { id } = request.params as { id: string };

    const calendar = await app.knex('calendars').where({ id }).first();
    if (!calendar) return reply.status(404).send({ error: '日历不存在' });

    await app.knex('calendars').where({ id }).del();
    return reply.status(204).send();
  });

  // ==================== 日历成员管理 ====================

  // GET /api/calendars/:id/members — 成员列表
  app.get('/api/calendars/:id/members', async (request, reply) => {
    const authUser = getAuthUser(request);
    if (!authUser) return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });

    const { id } = request.params as { id: string };

    const calendar = await app.knex('calendars').where({ id }).first();
    if (!calendar) return reply.status(404).send({ error: '日历不存在' });

    // admin 或日历成员可查看
    if (authUser.role !== 'admin') {
      const isMember = await isCalendarManager(app, id, authUser.sub);
      if (!isMember && calendar.owner_id !== authUser.sub) {
        return reply.status(403).send({ error: '无权查看此日历成员' });
      }
    }

    const members = await app.knex('calendar_members')
      .select('users.id', 'users.username', 'users.role', 'users.nickname', 'users.instruments')
      .join('users', 'calendar_members.user_id', 'users.id')
      .where('calendar_members.calendar_id', id);

    return { data: members };
  });

  // POST /api/calendars/:id/members — 添加成员
  app.post('/api/calendars/:id/members', async (request, reply) => {
    const authUser = getAuthUser(request);
    if (!authUser) return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });

    const { id } = request.params as { id: string };

    const calendar = await app.knex('calendars').where({ id }).first();
    if (!calendar) return reply.status(404).send({ error: '日历不存在' });

    // admin 或日历 manager 可添加成员
    if (authUser.role !== 'admin') {
      const isManager = await isCalendarManager(app, id, authUser.sub);
      if (!isManager && calendar.owner_id !== authUser.sub) {
        return reply.status(403).send({ error: '无权管理此日历成员' });
      }
    }

    const parsed = z.object({ user_id: z.string().uuid() }).safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: '参数错误，需要有效的 user_id' });
    }

    // 检查用户是否存在
    const user = await app.knex('users').where({ id: parsed.data.user_id }).first();
    if (!user) return reply.status(404).send({ error: '用户不存在' });

    // 检查是否已是成员
    const existing = await app.knex('calendar_members')
      .where({ calendar_id: id, user_id: parsed.data.user_id })
      .first();
    if (existing) return reply.status(409).send({ error: '该用户已是日历成员' });

    await app.knex('calendar_members').insert({
      calendar_id: id,
      user_id: parsed.data.user_id,
    });

    return reply.status(201).send({ data: { calendar_id: id, user_id: parsed.data.user_id } });
  });

  // DELETE /api/calendars/:id/members/:userId — 移除成员
  app.delete('/api/calendars/:id/members/:userId', async (request, reply) => {
    const authUser = getAuthUser(request);
    if (!authUser) return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });

    const { id, userId } = request.params as { id: string; userId: string };

    const calendar = await app.knex('calendars').where({ id }).first();
    if (!calendar) return reply.status(404).send({ error: '日历不存在' });

    // admin 或日历 manager 可移除成员
    if (authUser.role !== 'admin') {
      const isManager = await isCalendarManager(app, id, authUser.sub);
      if (!isManager && calendar.owner_id !== authUser.sub) {
        return reply.status(403).send({ error: '无权管理此日历成员' });
      }
    }

    const deleted = await app.knex('calendar_members')
      .where({ calendar_id: id, user_id: userId })
      .del();

    if (!deleted) return reply.status(404).send({ error: '该用户不是日历成员' });

    return reply.status(204).send();
  });
}
