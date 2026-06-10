import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getAuthUser } from '../lib/auth';

const createMessageSchema = z.object({
  content: z.string().min(1, '内容不能为空').max(2000, '内容最多2000字'),
  reply_to_id: z.string().uuid().optional(),
});

/**
 * 检查用户是否有权访问该演出
 */
async function canAccessGig(app: FastifyInstance, gigId: string, userId: string): Promise<boolean> {
  const gig = await app.knex('gigs').where({ id: gigId }).first();
  if (!gig) return false;

  // admin 通行
  const user = await app.knex('users').where({ id: userId }).first();
  if (!user) return false;
  if (user.role === 'admin') return true;

  // manager: 检查是否是该日历的成员
  if (user.role === 'manager') {
    const member = await app.knex('calendar_members')
      .where({ calendar_id: gig.calendar_id, user_id: userId })
      .first();
    if (member) return true;
  }

  // musician: 检查是否参与者
  const participant = await app.knex('gig_participants')
    .where({ gig_id: gigId, user_id: userId })
    .first();
  if (participant) return true;

  return false;
}

export async function messageRoutes(app: FastifyInstance) {
  // GET /api/gigs/:id/messages — 获取留言列表
  app.get('/api/gigs/:id/messages', async (request, reply) => {
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    const { id } = request.params as { id: string };

    const canAccess = await canAccessGig(app, id, user.sub);
    if (!canAccess) {
      const exists = await app.knex('gigs').where({ id }).first();
      if (!exists) return reply.status(404).send({ error: '演出不存在' });
      return reply.status(403).send({ error: '无权访问此留言板' });
    }

    const messages = await app.knex('gig_messages')
      .select(
        'gig_messages.*',
        'users.nickname',
        'users.role',
      )
      .leftJoin('users', 'gig_messages.user_id', 'users.id')
      .where('gig_messages.gig_id', id)
      .orderBy('gig_messages.created_at', 'asc');

    // 批量查询回复目标信息
    const replyIds = messages.filter((m: any) => m.reply_to_id).map((m: any) => m.reply_to_id);
    let replyMap: Record<string, { nickname: string | null; content: string }> = {};
    if (replyIds.length > 0) {
      const replied = await app.knex('gig_messages')
        .select('gig_messages.id', 'gig_messages.content', 'users.nickname')
        .leftJoin('users', 'gig_messages.user_id', 'users.id')
        .whereIn('gig_messages.id', replyIds);
      for (const r of replied) {
        replyMap[r.id] = { nickname: r.nickname, content: r.content };
      }
    }

    const data = messages.map((m: any) => ({
      ...m,
      reply_to: m.reply_to_id ? (replyMap[m.reply_to_id] || { nickname: null, content: '已删除' }) : null,
    }));

    return { data };
  });

  // POST /api/gigs/:id/messages — 发送留言
  app.post('/api/gigs/:id/messages', async (request, reply) => {
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    const { id } = request.params as { id: string };

    const canAccess = await canAccessGig(app, id, user.sub);
    if (!canAccess) {
      const exists = await app.knex('gigs').where({ id }).first();
      if (!exists) return reply.status(404).send({ error: '演出不存在' });
      return reply.status(403).send({ error: '无权发送留言' });
    }

    const parsed = createMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: '参数错误',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const [message] = await app.knex('gig_messages')
      .insert({
        gig_id: id,
        user_id: user.sub,
        content: parsed.data.content,
        reply_to_id: parsed.data.reply_to_id || null,
      })
      .returning('*');

    // 联表查询用户信息
    const userInfo = await app.knex('users')
      .select('nickname', 'role')
      .where({ id: user.sub })
      .first();

    // 如果有回复目标，查询被回复的留言
    let replyTo: { nickname: string | null; content: string } | null = null;
    if (parsed.data.reply_to_id) {
      const replied = await app.knex('gig_messages')
        .select('gig_messages.content', 'users.nickname')
        .leftJoin('users', 'gig_messages.user_id', 'users.id')
        .where('gig_messages.id', parsed.data.reply_to_id)
        .first();
      if (replied) {
        replyTo = { nickname: replied.nickname, content: replied.content };
      } else {
        replyTo = { nickname: null, content: '已删除' };
      }
    }

    return reply.status(201).send({
      data: {
        ...message,
        nickname: userInfo?.nickname,
        role: userInfo?.role,
        reply_to: replyTo,
      },
    });
  });

  // DELETE /api/gigs/:id/messages/:msgId — 删除留言
  app.delete('/api/gigs/:id/messages/:msgId', async (request, reply) => {
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    const { id, msgId } = request.params as { id: string; msgId: string };

    const message = await app.knex('gig_messages').where({ id: msgId, gig_id: id }).first();
    if (!message) {
      return reply.status(404).send({ error: '留言不存在' });
    }

    // 本人 或 admin 可删除
    if (message.user_id !== user.sub && user.role !== 'admin') {
      return reply.status(403).send({ error: '无权删除此留言' });
    }

    await app.knex('gig_messages').where({ id: msgId }).del();
    // 删除后，其他留言的 reply_to_id 仍然指向此 ID，GET 时会显示"已删除"
    return reply.status(204).send();
  });
}
