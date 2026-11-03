import { createApp } from './app';
import { ensureAdmin } from './auth';
import { connectDb } from './config/db';
import { env } from './config/env';
import { DEFAULT_FOODS } from '@nutrimapache/shared';
import { seedFoods } from './models';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[api] escuchando en :${env.PORT}`);
});

async function connectWithRetry(attempt = 1): Promise<void> {
  try {
    await connectDb();
    await ensureAdmin(env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
    await seedFoods(DEFAULT_FOODS);
  } catch (err) {
    const wait = Math.min(30, attempt * 3);
    console.warn(`[db] sin conexión (${(err as Error).message}); reintento en ${wait}s`);
    setTimeout(() => void connectWithRetry(attempt + 1), wait * 1000);
  }
}

void connectWithRetry();
