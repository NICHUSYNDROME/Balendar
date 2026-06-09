import Fastify from 'fastify';
import cors from '@fastify/cors';
import knex from 'knex';
import config from '../knexfile';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { calendarRoutes } from './routes/calendars';

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

  server.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await server.register(authRoutes);
  await server.register(userRoutes);
  await server.register(calendarRoutes);

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
