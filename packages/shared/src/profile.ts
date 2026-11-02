import { z } from 'zod';

/** Una comida del día, definida por cada persona (2 a 6). */
export const mealSlotSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]{1,24}$/),
  label: z.string().min(1).max(30),
  /** Hora aproximada "HH:MM", solo para ordenar y para el saludo de la mascota. */
  time: z.string().regex(/^\d{2}:\d{2}$/),
  emoji: z.string().max(4).optional(),
});
export type MealSlot = z.infer<typeof mealSlotSchema>;

export const trainingTypeSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]{1,24}$/),
  label: z.string().min(1).max(30),
});
export type TrainingType = z.infer<typeof trainingTypeSchema>;

/** Rutina semanal: índice 0 = lunes … 6 = domingo. null = libre. */
export const routineSchema = z.array(
  z.object({
    trainingKey: z.string().nullable(),
    moment: z.enum(['mañana', 'mediodía', 'tarde', 'noche']).nullable(),
  }),
).length(7);
export type Routine = z.infer<typeof routineSchema>;

export const goalSchema = z.enum([
  'acompañar-habitos',
  'reduccion-gradual-conservando-musculo',
  'mantener',
  'ganar-masa-muscular',
  'mas-energia',
]);
export type Goal = z.infer<typeof goalSchema>;

export const GOAL_LABELS: Record<Goal, string> = {
  'acompañar-habitos': 'Acompañar mis hábitos',
  'reduccion-gradual-conservando-musculo': 'Bajar de peso de a poco, cuidando el músculo',
  mantener: 'Mantenerme como estoy',
  'ganar-masa-muscular': 'Ganar masa muscular',
  'mas-energia': 'Tener más energía',
};

export const viewPrefsSchema = z.object({
  showCalories: z.boolean().default(false),
  showMacros: z.boolean().default(false),
  /** Soniditos de Cachete */
  sound: z.boolean().default(true),
});

/** Lo que tiene puesto Cachete y lo que ya desbloqueó (nunca se pierde). */
export const lookSchema = z.object({
  head: z.string().max(20).nullable().default(null),
  face: z.string().max(20).nullable().default(null),
  neck: z.string().max(20).nullable().default(null),
  ribbon: z.string().max(20).nullable().default(null),
  unlocked: z.array(z.string().max(20)).max(50).default([]),
});
export type Look = z.infer<typeof lookSchema>;

export const consentsSchema = z.object({
  photoStorage: z.boolean().default(false),
  aiAnalysis: z.boolean().default(false),
  acceptedAt: z.string().datetime().nullable().default(null),
  version: z.string().default('2026-11'),
});

/** Para la fórmula de gasto energético. "no-decir" usa un promedio. */
export const bodySexSchema = z.enum(['femenino', 'masculino', 'no-decir']);
export type BodySex = z.infer<typeof bodySexSchema>;

export const profileSchema = z.object({
  displayName: z.string().min(1).max(40),
  age: z.number().int().min(14).max(110).optional(),
  heightCm: z.number().min(120).max(230).optional(),
  weightKg: z.number().min(30).max(300).optional(),
  sex: bodySexSchema.optional(),
  goal: goalSchema,
  workContext: z.string().max(120).optional(),
  mealSlots: z.array(mealSlotSchema).min(2).max(6),
  trainingTypes: z.array(trainingTypeSchema).max(10),
  routine: routineSchema,
  view: viewPrefsSchema,
  consents: consentsSchema,
  mascotName: z.string().min(1).max(20).default('Cachete'),
  look: lookSchema.default({}),
});
export type Profile = z.infer<typeof profileSchema>;

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;

/** Índice 0 = lunes para una fecha JS. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}
