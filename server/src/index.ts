import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import fs from 'fs';
// 尝试加载 .env（兼容本地 dev 和服务器部署的不同路径）
const envPaths = [
  path.resolve(__dirname, '../../.env'),  // from dist/src -> server/
  path.resolve(process.cwd(), '.env'),    // from CWD
  path.resolve(process.cwd(), 'server/.env'), // from project root -> server/
];
for (const p of envPaths) {
  if (fs.existsSync(p)) { dotenvConfig({ path: p }); break; }
}
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import knex from 'knex';
import knexConfig from '../knexfile';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { calendarRoutes } from './routes/calendars';
import { gigRoutes } from './routes/gigs';
import { songRoutes } from './routes/songs';
import { messageRoutes } from './routes/messages';
import { uploadRoutes } from './routes/upload';

declare module 'fastify' {
  interface FastifyInstance {
    knex: ReturnType<typeof knex>;
  }
}

const server = Fastify({ logger: true });

async function main() {
  const db = knex(knexConfig.development);

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
  await server.register(songRoutes);
  await server.register(messageRoutes);
  await server.register(uploadRoutes);

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
