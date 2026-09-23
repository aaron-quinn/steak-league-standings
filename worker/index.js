import { Hono } from 'hono';
import apiRoutes from './routes/index.js';

// Only /api/* reaches this Worker. Everything else is served straight from the
// built site in dist/ (see "assets" in wrangler.jsonc).
const app = new Hono();

app.route('/api', apiRoutes);

app.onError((error, c) => {
  console.error(error);
  return c.json(
    {
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Something went wrong.',
    },
    500,
  );
});

export default app;
