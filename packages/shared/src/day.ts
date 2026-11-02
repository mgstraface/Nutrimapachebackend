import { z } from 'zod';
import type { Profile } from './profile';
import { weekdayIndex } from './profile';

/** Actividades comunes para anotar algo distinto a la rutina, en un toque. */
export const ACTIVITY_KINDS = [
  { key: 'caminata', label: 'Caminata', emoji: '🚶‍♀️' },
  { key: 'bici', label: 'Bici', emoji: '🚲' },
  { key: 'fuerza', label: 'Fuerza', emoji: '🏋️‍♀️' },
  { key: 'correr', label: 'Correr', emoji: '🏃‍♀️' },
  { key: 'yoga', label: 'Yoga / estirar', emoji: '🧘‍♀️' },
  { key: 'natacion', label: 'Natación', emoji: '🏊‍♀️' },
  { key: 'baile', label: 'Baile', emoji: '💃' },
  { key: 'otro', label: 'Otra cosa', emoji: '✨' },
] as const;

export const activitySchema = z.object({
  /** key de ACTIVITY_KINDS o de un trainingType del perfil */
  kind: z.string().min(1).max(30),
  label: z.string().min(1).max(40),
  minutes: z.number().int().min(1).max(600).optional(),
  /** 1 = suave · 5 = a pleno */
  intensity: z.number().int().min(1).max(5).optional(),
});
export type Activity = z.infer<typeof activitySchema>;

/**
 * Cómo fue la actividad del día respecto de la rutina:
 * - como-plan: hizo lo que tocaba
 * - distinto: hizo otra cosa (ver activities)
 * - descanso: decidió descansar (siempre válido, sin culpa)
 * Sin estado = no anotó nada, y eso también está bien.
 */
export const dayStatusSchema = z.enum(['como-plan', 'distinto', 'descanso']);
export type DayStatus = z.infer<typeof dayStatusSchema>;

export const dayLogSchema = z.object({
  status: dayStatusSchema.nullable().default(null),
  activities: z.array(activitySchema).max(10).default([]),
  energy: z.number().int().min(1).max(5).nullable().default(null),
  water: z.number().int().min(0).max(30).default(0),
  note: z.string().max(280).default(''),
  /** ¿Cómo estás? (opcional) */
  mood: z.enum(['contenta', 'tranqui', 'cansada', 'ansiosa', 'triste']).nullable().default(null),
});
export type DayLogInput = z.infer<typeof dayLogSchema>;
export type DayLog = DayLogInput & { date: string; updatedAt?: string };

export const emptyDay = (date: string): DayLog => ({ date, status: null, activities: [], energy: null, water: 0, note: '', mood: null });

/** Lo que tocaba según la rutina para esa fecha (o null si era día libre). */
export function plannedFor(profile: Profile, date: Date) {
  const r = profile.routine[weekdayIndex(date)];
  const t = profile.trainingTypes.find((x) => x.key === r?.trainingKey);
  return t ? { key: t.key, label: t.label, moment: r?.moment ?? null } : null;
}

/** Texto corto para chips e historial. */
export function summarizeDay(day: DayLog | undefined, planned: { label: string } | null): string | null {
  if (!day?.status) return null;
  if (day.status === 'descanso') return 'Descanso';
  if (day.status === 'como-plan') return planned ? `${planned.label} ✓` : 'Actividad ✓';
  const parts = day.activities.map((a) => (a.minutes ? `${a.label} ${formatMinutes(a.minutes)}` : a.label));
  return parts.length ? parts.join(' + ') : 'Otra actividad';
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
