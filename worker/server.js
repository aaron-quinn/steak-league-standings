// ESM
import Fastify from 'fastify';
import cors from '@fastify/cors';
import routes from './routes/index.js';
const fastify = Fastify({ logger: true });
await fastify.register(cors, {
  origin: true,
});

const port = process.env.PORT || 3000;
const host = 'RENDER' in process.env ? `0.0.0.0` : `localhost`;

// Register routes
fastify.register(routes);

const start = async () => {
  try {
    await fastify.listen({ host: host, port: port });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
