import Fastify from 'fastify';
import cors from '@fastify/cors';

const server = Fastify({ logger: true });

async function main() {
  await server.register(cors, {
    origin: ['http://localhost:5173'],
    credentials: true,
  });

  server.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

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
