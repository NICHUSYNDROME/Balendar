import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getAuthUser, requireAdmin } from '../lib/auth';

// ==================== Zod 校验 ====================

const createGigSchema = z.object({
  calendar_id: z.string().uuid(),
  title: z.string().min(1, '演出标题不能为空').max(200),
  start_time: z.string().datetime({ message: '开始时间格式不正确' }),
  end_time: z.string().datetime({ message: '结束时间格式不正确' }),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const updateGigSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const addParticipantSchema = z.object({
  user_id: z.string().uuid(),
});

// Setlist 校验
const setlistItemSchema = z.discriminatedUnion('type', [
  z.object({
    order: z.number().int().min(0),
    type: z.literal('song'),
    song_id: z.string().uuid().optional(),
    song_name: z.string().min(1, '曲名不能为空'),
    artist: z.string().min(1, '歌手不能为空'),
    original_key: z.string().optional(),
    transpose: z.number().int().optional(),
    temp_note: z.string().optional(),
  }),
  z.object({
    order: z.number().int().min(0),
    type: z.literal('break'),
    duration_minutes: z.number().positive('时长必须大于0'),
    note: z.string().optional(),
  }),
  z.object({
    order: z.number().int().min(0),
    type: z.literal('game'),
    description: z.string().optional(),
  }),
]);

const setlistSchema = z.object({
  items: z.array(setlistItemSchema),
});

// ==================== 辅助函数 ====================

/**
 * 检查用户是否是某个日历的管理员
 */
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

/**
 * 生成地图链接
 */
function generateMapUrl(address: string): string {
  const encoded = encodeURIComponent(address);
  return `https://uri.amap.com/marker?position=&name=${encoded}`;
}

/**
 * 行级权限过滤中间件 — 检查当前用户是否有权操作指定演出
 * @returns gig 对象 或 null（已发送错误响应）
 */
async function requireGigAccess(
  app: FastifyInstance,
  request: FastifyRequest,
  gigId: string,
): Promise<{ gig: any; user: any } | null> {
  const user = getAuthUser(request);
  if (!user) return null;

  const gig = await app.knex('gigs').where({ id: gigId }).first();
  if (!gig) return null; // caller 负责 404

  // admin 通行
  if (user.role === 'admin') return { gig, user };

  // manager: 检查是否是该日历的管理员
  if (user.role === 'manager') {
    const isManager = await isCalendarManager(app, gig.calendar_id, user.sub);
    if (!isManager) return null; // 403
    return { gig, user };
  }

  // musician: 只读操作检查是否参与者
  if (user.role === 'musician') {
    const isParticipant = await app.knex('gig_participants')
      .where({ gig_id: gigId, user_id: user.sub })
      .first();
    if (!isParticipant) return null; // 403
    return { gig, user };
  }

  return null;
}

// ==================== 路由 ====================

export async function gigRoutes(app: FastifyInstance) {
  // ==================== 演出 CRUD ====================

  /**
   * GET /api/gigs — 演出列表（行级权限过滤）
   */
  app.get('/api/gigs', async (request, reply) => {
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    let query = app.knex('gigs')
      .select(
        'gigs.*',
        'calendars.name as calendar_name',
      )
      .leftJoin('calendars', 'gigs.calendar_id', 'calendars.id');

    // 行级权限过滤
    if (user.role === 'admin') {
      // admin: 全部
    } else if (user.role === 'manager') {
      // manager: 自己管理的日历下的演出
      query = query.whereIn('gigs.calendar_id', function (this: any) {
        this.select('calendar_id')
          .from('calendar_members')
          .where('user_id', user.sub);
      });
    } else {
      // musician: 仅参与的演出
      query = query.whereIn('gigs.id', function (this: any) {
        this.select('gig_id')
          .from('gig_participants')
          .where('user_id', user.sub);
      });
    }

    // 支持按日历过滤
    const { calendar_id, start, end } = request.query as {
      calendar_id?: string;
      start?: string;
      end?: string;
    };
    if (calendar_id) query = query.where('gigs.calendar_id', calendar_id);
    if (start) query = query.where('gigs.start_time', '>=', start);
    if (end) query = query.where('gigs.end_time', '<=', end);

    const gigs = await query.orderBy('gigs.start_time', 'desc');

    // 批量获取参与者
    const gigIds = gigs.map((g: any) => g.id);
    let participantsMap: Record<string, any[]> = {};

    if (gigIds.length > 0) {
      const participants = await app.knex('gig_participants')
        .select(
          'gig_participants.gig_id',
          'gig_participants.user_id',
          'users.nickname',
          'users.instruments',
        )
        .leftJoin('users', 'gig_participants.user_id', 'users.id')
        .whereIn('gig_participants.gig_id', gigIds);

      for (const p of participants) {
        if (!participantsMap[p.gig_id]) participantsMap[p.gig_id] = [];
        participantsMap[p.gig_id].push({
          user_id: p.user_id,
          nickname: p.nickname,
          instruments: p.instruments,
        });
      }
    }

    const data = gigs.map((gig: any) => ({
      ...gig,
      participants: participantsMap[gig.id] || [],
    }));

    return { data };
  });

  /**
   * POST /api/gigs — 创建演出（admin / manager）
   */
  app.post('/api/gigs', async (request, reply) => {
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    if (user.role === 'musician') {
      return reply.status(403).send({ error: '乐手无权创建演出' });
    }

    const parsed = createGigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: '参数错误',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { calendar_id, title, start_time, end_time, location, notes } = parsed.data;

    // manager 只能在自己的日历下创建
    if (user.role === 'manager') {
      const isManager = await isCalendarManager(app, calendar_id, user.sub);
      if (!isManager) {
        return reply.status(403).send({ error: '无权在此日历下创建演出' });
      }
    }

    // 生成地图链接
    const location_url = location ? generateMapUrl(location) : null;

    const [gig] = await app.knex('gigs')
      .insert({
        calendar_id,
        title,
        start_time,
        end_time,
        location: location || null,
        location_url,
        notes: notes || '',
        setlist: JSON.stringify({ items: [] }),
        created_by: user.sub,
      })
      .returning('*');

    return reply.status(201).send({ data: gig });
  });

  /**
   * GET /api/gigs/:id — 演出详情
   */
  app.get('/api/gigs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await requireGigAccess(app, request, id);
    if (!result) {
      const user = getAuthUser(request);
      if (!user) return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });

      // 检查演出是否存在
      const exists = await app.knex('gigs').where({ id }).first();
      if (!exists) return reply.status(404).send({ error: '演出不存在' });
      return reply.status(403).send({ error: '无权访问此演出' });
    }

    const gig = await app.knex('gigs')
      .select('gigs.*', 'calendars.name as calendar_name')
      .leftJoin('calendars', 'gigs.calendar_id', 'calendars.id')
      .where('gigs.id', id)
      .first();

    // 获取参与者
    const participants = await app.knex('gig_participants')
      .select(
        'gig_participants.user_id',
        'users.nickname',
        'users.instruments',
        // 仅 admin/manager 可见手机号
        ...(result.user.role !== 'musician'
          ? [app.knex.raw("SUBSTRING(users.phone, 1, 3) || '****' || SUBSTRING(users.phone, 8, 4) as phone")]
          : []),
      )
      .leftJoin('users', 'gig_participants.user_id', 'users.id')
      .where('gig_participants.gig_id', id);

    return { data: { ...gig, participants } };
  });

  /**
   * PUT /api/gigs/:id — 更新演出（admin / manager）
   */
  app.put('/api/gigs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    const result = await requireGigAccess(app, request, id);
    if (!result) {
      const exists = await app.knex('gigs').where({ id }).first();
      if (!exists) return reply.status(404).send({ error: '演出不存在' });
      return reply.status(403).send({ error: '无权编辑此演出' });
    }

    // musician 不能编辑
    if (user.role === 'musician') {
      return reply.status(403).send({ error: '乐手无权编辑演出' });
    }

    const parsed = updateGigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: '参数错误',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const updateData: Record<string, any> = {
      ...parsed.data,
      updated_at: app.knex.fn.now(),
    };

    // 如果更新了地点，重新生成地图链接
    if (parsed.data.location !== undefined) {
      updateData.location_url = parsed.data.location
        ? generateMapUrl(parsed.data.location)
        : null;
    }

    const [gig] = await app.knex('gigs')
      .where({ id })
      .update(updateData)
      .returning('*');

    return { data: gig };
  });

  /**
   * DELETE /api/gigs/:id — 删除演出（admin / manager）
   */
  app.delete('/api/gigs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    const result = await requireGigAccess(app, request, id);
    if (!result) {
      const exists = await app.knex('gigs').where({ id }).first();
      if (!exists) return reply.status(404).send({ error: '演出不存在' });
      return reply.status(403).send({ error: '无权删除此演出' });
    }

    if (user.role === 'musician') {
      return reply.status(403).send({ error: '乐手无权删除演出' });
    }

    await app.knex('gigs').where({ id }).delete();
    return reply.status(204).send();
  });

  // ==================== 参与者管理 ====================

  /**
   * GET /api/gigs/:id/participants — 参与者列表
   */
  app.get('/api/gigs/:id/participants', async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await requireGigAccess(app, request, id);
    if (!result) {
      const user = getAuthUser(request);
      if (!user) return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
      const exists = await app.knex('gigs').where({ id }).first();
      if (!exists) return reply.status(404).send({ error: '演出不存在' });
      return reply.status(403).send({ error: '无权查看参与者' });
    }

    const participants = await app.knex('gig_participants')
      .select(
        'gig_participants.user_id',
        'users.nickname',
        'users.instruments',
        ...(result.user.role !== 'musician'
          ? [app.knex.raw("SUBSTRING(users.phone, 1, 3) || '****' || SUBSTRING(users.phone, 8, 4) as phone")]
          : []),
      )
      .leftJoin('users', 'gig_participants.user_id', 'users.id')
      .where('gig_participants.gig_id', id);

    return { data: participants };
  });

  /**
   * POST /api/gigs/:id/participants — 添加参与者（admin / manager）
   */
  app.post('/api/gigs/:id/participants', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    const result = await requireGigAccess(app, request, id);
    if (!result) {
      const exists = await app.knex('gigs').where({ id }).first();
      if (!exists) return reply.status(404).send({ error: '演出不存在' });
      return reply.status(403).send({ error: '无权管理参与者' });
    }

    if (user.role === 'musician') {
      return reply.status(403).send({ error: '乐手无权管理参与者' });
    }

    const parsed = addParticipantSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: '参数错误',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    // 检查用户是否存在
    const targetUser = await app.knex('users')
      .where({ id: parsed.data.user_id })
      .first();
    if (!targetUser) {
      return reply.status(404).send({ error: '用户不存在' });
    }

    // 添加（幂等：如果已存在则忽略冲突）
    await app.knex('gig_participants')
      .insert({ gig_id: id, user_id: parsed.data.user_id })
      .onConflict(['gig_id', 'user_id'])
      .ignore();

    return reply.status(201).send({
      data: { gig_id: id, user_id: parsed.data.user_id },
    });
  });

  /**
   * DELETE /api/gigs/:id/participants/:userId — 移除参与者（admin / manager）
   */
  app.delete('/api/gigs/:id/participants/:userId', async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    const result = await requireGigAccess(app, request, id);
    if (!result) {
      const exists = await app.knex('gigs').where({ id }).first();
      if (!exists) return reply.status(404).send({ error: '演出不存在' });
      return reply.status(403).send({ error: '无权管理参与者' });
    }

    if (user.role === 'musician') {
      return reply.status(403).send({ error: '乐手无权管理参与者' });
    }

    await app.knex('gig_participants')
      .where({ gig_id: id, user_id: userId })
      .delete();

    return reply.status(204).send();
  });

  // ==================== Setlist 管理 ====================

  /**
   * PUT /api/gigs/:id/setlist — 更新歌单
   */
  app.put('/api/gigs/:id/setlist', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    const result = await requireGigAccess(app, request, id);
    if (!result) {
      const exists = await app.knex('gigs').where({ id }).first();
      if (!exists) return reply.status(404).send({ error: '演出不存在' });
      return reply.status(403).send({ error: '无权编辑歌单' });
    }

    if (user.role === 'musician') {
      return reply.status(403).send({ error: '乐手无权编辑歌单' });
    }

    const parsed = setlistSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: '歌单数据格式错误',
        details: parsed.error.flatten(),
      });
    }

    // 重新编号确保 order 连续
    const items = parsed.data.items.map((item, index) => ({ ...item, order: index }));

    const [gig] = await app.knex('gigs')
      .where({ id })
      .update({
        setlist: JSON.stringify({ items }),
        updated_at: app.knex.fn.now(),
      })
      .returning('*');

    return { data: gig.setlist };
  });
}
