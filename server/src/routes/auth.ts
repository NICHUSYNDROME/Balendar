import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { signToken, verifyToken, JwtPayload } from '../lib/jwt';

const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post('/api/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: '参数错误',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { username, password } = parsed.data;

    const result = await request.server.knex('users')
      .where({ username })
      .first();

    if (!result) {
      return reply.status(401).send({ error: '用户名或密码错误' });
    }

    const valid = await bcrypt.compare(password, result.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: '用户名或密码错误' });
    }

    const token = signToken({
      sub: result.id,
      role: result.role,
      username: result.username,
    });

    return {
      data: {
        token,
        user: {
          id: result.id,
          username: result.username,
          role: result.role,
          nickname: result.nickname,
          instruments: result.instruments,
        },
      },
    };
  });

  // GET /api/auth/me
  app.get('/api/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: '未提供认证令牌' });
    }

    let payload: JwtPayload;
    try {
      payload = verifyToken(authHeader.slice(7));
    } catch {
      return reply.status(401).send({ error: '令牌无效或已过期' });
    }

    const user = await request.server.knex('users')
      .where({ id: payload.sub })
      .select('id', 'username', 'role', 'nickname', 'instruments')
      .first();

    if (!user) {
      return reply.status(401).send({ error: '用户不存在' });
    }

    return { data: user };
  });
}
