import { z } from 'zod';
import { mealItemSchema } from './meal';

/** Lo que manda la app: la foto ya achicada en el celular (JPEG en base64, sin metadatos). */
export const photoAnalysisRequestSchema = z.object({
  image: z
    .string()
    .min(100)
    .max(4_000_000)
    .regex(/^[A-Za-z0-9+/=]+$/, 'Imagen inválida'),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
  /** Nombre de la comida del día ("Almuerzo"), para dar contexto. Nada personal. */
  slotLabel: z.string().max(30).optional(),
});
export type PhotoAnalysisRequest = z.infer<typeof photoAnalysisRequestSchema>;

export const photoAnalysisSchema = z.object({
  /** Descripción corta y neutra del plato */
  description: z.string().max(280),
  items: z.array(mealItemSchema).max(20),
  /** La foto no parece mostrar comida */
  notFood: z.boolean().default(false),
  /** Aviso sobre lo que la foto no deja ver (aceite, salsas, porciones tapadas...) */
  uncertaintyNote: z.string().max(280).default(''),
});
export type PhotoAnalysis = z.infer<typeof photoAnalysisSchema>;

export interface AnalysisQuota {
  enabled: boolean;
  usedToday: number;
  dailyLimit: number;
}
