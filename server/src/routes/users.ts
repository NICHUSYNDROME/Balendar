import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAdmin } from '../lib/auth';

const createUserSchema = z.object({
  username: z.string().min(2, '用户名至少2个字符').max(32, '用户名最多32个字符'),
  password: z.string().min(6, '密码至少6个字符').max(128),
  role: z.enum(['admin', 'manager', 'musician']).optional().default('musician'),
  nickname: z.string().max(64).optional(),
  phone: z.string().max(20).optional(),
  instruments: z.array(z.string()).optional().default([]),
});

const updateUserSchema = z.object({
  password: z.string().min(6).max(128).optional(),
  role: z.enum(['admin', 'manager', 'musician']).optional(),
  nickname: z.string().max(64).optional(),
  phone: z.string().max(20).optional(),
  instruments: z.array(z.string()).optional(),
});

export async function userRoutes(app: FastifyInstance) {
  // GET /api/users — 用户列表（admin 专用）
  app.get('/api/users', async (request, reply) => {
    const authUser = await requireAdmin(request, reply);
    if (!authUser) return;

    const users = await app.knex('users')
      .select('id', 'username', 'role', 'nickname', 'phone', 'instruments', 'created_at')
      .orderBy('created_at', 'asc');

    return { data: users };
  });

  // POST /api/users — 创建用户（admin 专用）
  app.post('/api/users', async (request, reply) => {
    const authUser = await requireAdmin(request, reply);
    if (!authUser) return;

    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: '参数错误',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { username, password, role, nickname, phone, instruments } = parsed.data;

    // 检查用户名是否已存在
    const existing = await app.knex('users').where({ username }).first();
    if (existing) {
      return reply.status(409).send({ error: '用户名已存在' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await app.knex('users')
      .insert({
        username,
        password_hash: passwordHash,
        role,
        nickname: nickname || null,
        phone: phone || null,
        instruments: JSON.stringify(instruments),
      })
      .returning(['id', 'username', 'role', 'nickname', 'phone', 'instruments', 'created_at']);

    return reply.status(201).send({ data: user });
  });

  // PATCH /api/users/:id — 编辑用户（admin 专用）
  app.patch('/api/users/:id', async (request, reply) => {
    const authUser = await requireAdmin(request, reply);
    if (!authUser) return;

    const { id } = request.params as { id: string };

    const existing = await app.knex('users').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: '用户不存在' });
    }

    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: '参数错误',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.password !== undefined) {
      updateData.password_hash = await bcrypt.hash(parsed.data.password, 10);
    }
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
    if (parsed.data.nickname !== undefined) updateData.nickname = parsed.data.nickname;
    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
    if (parsed.data.instruments !== undefined) {
      updateData.instruments = JSON.stringify(parsed.data.instruments);
    }
    updateData.updated_at = app.knex.fn.now();

    const [user] = await app.knex('users')
      .where({ id })
      .update(updateData)
      .returning(['id', 'username', 'role', 'nickname', 'phone', 'instruments', 'created_at']);

    return { data: user };
  });

  // DELETE /api/users/:id — 删除用户（admin 专用）
  app.delete('/api/users/:id', async (request, reply) => {
    const authUser = await requireAdmin(request, reply);
    if (!authUser) return;

    const { id } = request.params as { id: string };

    const existing = await app.knex('users').where({ id }).first();
    if (!existing) {
      return reply.status(404).send({ error: '用户不存在' });
    }

    // 防止删除自己
    if (id === authUser.sub) {
      return reply.status(400).send({ error: '不能删除自己' });
    }

    await app.knex('users').where({ id }).del();
    return reply.status(204).send();
  });
}
