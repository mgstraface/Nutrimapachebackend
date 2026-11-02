import type { DayLog } from './day';
import type { Look } from './profile';
import type { Meal } from './meal';

/**
 * Accesorios de Cachete. Se desbloquean con el uso y NUNCA se pierden:
 * una vez desbloqueado queda guardado en profile.look.unlocked.
 */
export type LookSlot = 'head' | 'face' | 'neck' | 'ribbon';

export interface UsageStats {
  meals: number;
  daysLogged: number;
  water: number;
  movedDays: number;
  photoMeals: number;
  moodDays: number;
}

export interface Accessory {
  key: string;
  slot: LookSlot;
  label: string;
  emoji: string;
  /** Cómo se consigue, en lenguaje amable */
  how: string;
  unlocked: (s: UsageStats) => boolean;
}

export const ACCESSORIES: Accessory[] = [
  { key: 'flores', slot: 'ribbon', label: 'Flores en la cinta', emoji: '🌼', how: 'Anotá tu primera comida', unlocked: (s) => s.meals >= 1 },
  { key: 'mono', slot: 'ribbon', label: 'Moñito', emoji: '🎀', how: 'Anotá algo en 3 días distintos', unlocked: (s) => s.daysLogged >= 3 },
  { key: 'lentes', slot: 'face', label: 'Lentes de sol', emoji: '🕶️', how: 'Anotá tu movimiento 3 días', unlocked: (s) => s.movedDays >= 3 },
  { key: 'bufanda', slot: 'neck', label: 'Bufanda tejida', emoji: '🧣', how: 'Sumá 20 vasos de agua en total', unlocked: (s) => s.water >= 20 },
  { key: 'lana', slot: 'head', label: 'Gorrito de lana', emoji: '🧶', how: 'Anotá 15 comidas', unlocked: (s) => s.meals >= 15 },
  { key: 'poncho', slot: 'neck', label: 'Ponchito', emoji: '🪢', how: 'Anotá algo en 10 días distintos', unlocked: (s) => s.daysLogged >= 10 },
  { key: 'camara', slot: 'face', label: 'Lupa curiosa', emoji: '🔍', how: 'Anotá una comida con foto', unlocked: (s) => s.photoMeals >= 1 },
  { key: 'corona', slot: 'head', label: 'Corona de flores', emoji: '💐', how: 'Anotá 40 comidas', unlocked: (s) => s.meals >= 40 },
];

export const SLOT_LABELS: Record<LookSlot, string> = { head: 'Cabeza', face: 'Cara', neck: 'Cuello', ribbon: 'Cinta' };

export function usageStats(meals: Meal[], days: Record<string, DayLog>): UsageStats {
  const dates = new Set(meals.map((m) => m.date));
  let water = 0;
  let movedDays = 0;
  let moodDays = 0;
  for (const d of Object.values(days)) {
    water += d.water;
    if (d.status === 'como-plan' || d.status === 'distinto') movedDays++;
    if (d.mood) moodDays++;
    if (d.status || d.water > 0 || d.mood || d.energy !== null) dates.add(d.date);
  }
  return {
    meals: meals.length,
    daysLogged: dates.size,
    water,
    movedDays,
    photoMeals: meals.filter((m) => m.origin === 'ia').length,
    moodDays,
  };
}

/** Accesorios que se acaban de ganar (no estaban en look.unlocked). */
export function newUnlocks(look: Look, stats: UsageStats): Accessory[] {
  return ACCESSORIES.filter((a) => !look.unlocked.includes(a.key) && a.unlocked(stats));
}

export const accessoryByKey = (key: string | null | undefined) => ACCESSORIES.find((a) => a.key === key);
