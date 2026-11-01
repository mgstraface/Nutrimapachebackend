import { createApp } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[api] escuchando en :${env.PORT}`);
});

connectDb().catch((err) => {
  console.warn('[db] sin conexión todavía:', err.message);
});
