import { z } from 'zod';
import { confidenceSchema, rangeSchema } from './range';

export const foodGroupSchema = z.enum(['proteína', 'verdura', 'fruta', 'cereal', 'lácteo', 'grasa', 'bebida', 'otro']);
export type FoodGroup = z.infer<typeof foodGroupSchema>;

export const unitSchema = z.enum(['g', 'ml', 'porción', 'unidad', 'taza', 'cda']);

export const mealItemSchema = z.object({
  name: z.string().min(1).max(60),
  quantity: z.number().positive().optional(),
  unit: unitSchema.optional(),
  group: foodGroupSchema.default('otro'),
  kcal: rangeSchema.optional(),
  protein: rangeSchema.optional(),
  confidence: confidenceSchema.default('baja'),
  source: z.enum(['usuaria', 'catálogo', 'ia']).default('usuaria'),
  editedByUser: z.boolean().default(false),
});
export type MealItem = z.infer<typeof mealItemSchema>;

export const mealInputSchema = z.object({
  /** Día local "YYYY-MM-DD". */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** key de un mealSlot del perfil, o "extra". */
  slotKey: z.string().min(1).max(24),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  description: z.string().max(280).optional(),
  items: z.array(mealItemSchema).max(30).default([]),
  origin: z.enum(['manual', 'ia', 'plan', 'receta']).default('manual'),
  feeling: z
    .object({
      fullness: z.number().int().min(1).max(5).optional(),
      energy: z.number().int().min(1).max(5).optional(),
    })
    .optional(),
  note: z.string().max(280).optional(),
});
export type MealInput = z.infer<typeof mealInputSchema>;

export type Meal = MealInput & { id: string; createdAt: string; updatedAt: string };
