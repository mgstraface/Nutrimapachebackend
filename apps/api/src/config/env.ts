import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGO_URL: z.string().default('mongodb://localhost:27017/nutrimapache'),
  /**
   * Admin inicial: se crea solo si todavía no existe ningún admin.
   * Cambiar estos valores después no cambia la contraseña: eso se hace desde el panel.
   */
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().optional(),
  // Fase 4: las claves de IA viven solo acá, nunca en el frontend.
  AI_PROVIDER: z.enum(['mock', 'none']).default('mock'),
});

export const env = envSchema.parse(process.env);
export const isProd = env.NODE_ENV === 'production';
