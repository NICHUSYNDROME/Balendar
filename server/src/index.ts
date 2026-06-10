import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import knex from 'knex';
import config from '../knexfile';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { calendarRoutes } from './routes/calendars';
import { gigRoutes } from './routes/gigs';

declare module 'fastify' {
  interface FastifyInstance {
    knex: ReturnType<typeof knex>;
  }
}

const server = Fastify({ logger: true });

async function main() {
  const db = knex(config.development);

  await server.register(cors, {
    origin: ['http://localhost:5173'],
    credentials: true,
  });

  server.decorate('knex', db);

  // 生产环境: 注册静态文件服务
  if (process.env.NODE_ENV === 'production') {
    await server.register(fastifyStatic, {
      root: path.join(__dirname, '../../../client/dist'),
      wildcard: false,
    });
  }

  server.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await server.register(authRoutes);
  await server.register(userRoutes);
  await server.register(calendarRoutes);
  await server.register(gigRoutes);

  // SPA fallback: 前端路由返回 index.html
  if (process.env.NODE_ENV === 'production') {
    server.get('/*', async (request, reply) => {
      return reply.sendFile('index.html');
    });
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  try {
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Server running at http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
