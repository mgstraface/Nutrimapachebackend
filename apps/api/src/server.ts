import { createApp } from './app';
import { ensureAdmin } from './auth';
import { connectDb } from './config/db';
import { env } from './config/env';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[api] escuchando en :${env.PORT}`);
});

async function connectWithRetry(attempt = 1): Promise<void> {
  try {
    await connectDb();
    await ensureAdmin(env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
  } catch (err) {
    const wait = Math.min(30, attempt * 3);
    console.warn(`[db] sin conexión (${(err as Error).message}); reintento en ${wait}s`);
    setTimeout(() => void connectWithRetry(attempt + 1), wait * 1000);
  }
}

void connectWithRetry();
