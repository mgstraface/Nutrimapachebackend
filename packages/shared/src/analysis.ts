import { z } from 'zod';
import { mealItemSchema } from './meal';
import { rangeSchema, type Range } from './range';

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

/* ---------------- Inspiración: ideas de comidas ---------------- */

export const inspirationRequestSchema = z.object({
  slotKey: z.string().min(1).max(24),
  /** Nombres de ideas ya mostradas, para no repetir al pedir otras */
  exclude: z.array(z.string().max(80)).max(12).default([]),
});
export type InspirationRequest = z.infer<typeof inspirationRequestSchema>;

export const mealIdeaSchema = z.object({
  title: z.string().max(80),
  description: z.string().max(200),
  items: z.array(mealItemSchema).max(12),
  kcal: rangeSchema.optional(),
  protein: rangeSchema.optional(),
  prepMinutes: z.number().int().min(0).max(240).optional(),
  tags: z.array(z.string().max(20)).max(4).default([]),
});
export type MealIdea = z.infer<typeof mealIdeaSchema>;

export interface InspirationResponse {
  slotLabel: string;
  /** Objetivo orientativo de esa comida (si hay datos para calcularlo) */
  target: { kcal: Range; protein: Range } | null;
  ideas: MealIdea[];
}
