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
  /** Análisis de fotos: la clave vive solo en el servidor, nunca en el frontend. Sin clave, la función queda apagada. */
  ANTHROPIC_API_KEY: z.string().optional().transform((v) => (v && v.trim() ? v.trim() : undefined)),
  AI_MODEL: z.string().default('claude-haiku-5-5'),
  /** Tope de consultas a la IA (fotos + ideas) por persona por día, para que el gasto no se dispare */
  AI_DAILY_LIMIT: z.coerce.number().int().min(0).default(25),
});

export const env = envSchema.parse(process.env);
export const isProd = env.NODE_ENV === 'production';
