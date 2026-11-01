import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGO_URL: z.string().default('mongodb://localhost:27017/nutrimapache'),
  /** open = cualquiera crea cuenta · invite = solo el admin crea usuarios */
  REGISTRATION_MODE: z.enum(['open', 'invite']).default('invite'),
  JWT_SECRET: z.string().min(16).default('dev-only-secret-change-me'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Fase 4: las claves de IA viven solo acá, nunca en el frontend.
  AI_PROVIDER: z.enum(['mock', 'none']).default('mock'),
});

export const env = envSchema.parse(process.env);

if (env.NODE_ENV === 'production' && env.JWT_SECRET.startsWith('dev-only')) {
  throw new Error('JWT_SECRET de producción no configurado');
}
