import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { PROFILE_TEMPLATES } from '@nutrimapache/shared';
import { dbReady } from './config/db';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/errors';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  const api = express.Router();

  api.get('/health', (_req, res) => {
    res.json({ ok: true, db: dbReady() ? 'up' : 'down' });
  });

  api.get('/config', (_req, res) => {
    res.json({ registrationMode: env.REGISTRATION_MODE });
  });

  api.get('/profile-templates', (_req, res) => {
    res.json(PROFILE_TEMPLATES.map(({ id, title, description, profile }) => ({ id, title, description, profile })));
  });

  // Fase 2: auth, profile, meals, foods, photos, privacy, admin/users

  app.use('/api/v1', api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
