import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getAuthUser, requireAdminOrManager } from '../lib/auth';

const createSongSchema = z.object({
  name: z.string().min(1, '曲名不能为空').max(100),
  artist: z.string().min(1, '歌手不能为空').max(100),
  original_key: z.string().max(10).optional(),
});

const updateSongSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  artist: z.string().min(1).max(100).optional(),
  original_key: z.string().max(10).optional(),
});

export async function songRoutes(app: FastifyInstance) {
  // GET /api/songs — 歌曲列表（支持搜索）
  app.get('/api/songs', async (request, reply) => {
    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: '未提供认证令牌或令牌无效' });
    }

    const { q } = request.query as { q?: string };

    let query = app.knex('songs').select('*');

    if (q && q.trim()) {
      const keyword = `%${q.trim()}%`;
      query = query.where(function () {
        this.whereILike('name', keyword).orWhereILike('artist', keyword);
      });
    }

    const songs = await query.orderBy('name', 'asc');
    return { data: songs };
  });

  // POST /api/songs — 创建歌曲（admin / manager）
  app.post('/api/songs', async (request, reply) => {
    const user = await requireAdminOrManager(request, reply);
    if (!user) return;

    const parsed = createSongSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: '参数错误',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const [song] = await app.knex('songs')
      .insert({
        name: parsed.data.name,
        artist: parsed.data.artist,
        original_key: parsed.data.original_key || null,
      })
      .returning('*');

    return reply.status(201).send({ data: song });
  });

  // PUT /api/songs/:id — 编辑歌曲（admin / manager）
  app.put('/api/songs/:id', async (request, reply) => {
    const user = await requireAdminOrManager(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };

    const existing = await app.knex('songs').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: '歌曲不存在' });
    }

    const parsed = updateSongSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: '参数错误',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.artist !== undefined) updateData.artist = parsed.data.artist;
    if (parsed.data.original_key !== undefined) updateData.original_key = parsed.data.original_key;

    const [song] = await app.knex('songs')
      .where({ id })
      .update(updateData)
      .returning('*');

    return { data: song };
  });

  // DELETE /api/songs/:id — 删除歌曲（admin / manager）
  app.delete('/api/songs/:id', async (request, reply) => {
    const user = await requireAdminOrManager(request, reply);
    if (!user) return;

    const { id } = request.params as { id: string };

    const existing = await app.knex('songs').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: '歌曲不存在' });
    }

    await app.knex('songs').where({ id }).del();
    return reply.status(204).send();
  });
}
