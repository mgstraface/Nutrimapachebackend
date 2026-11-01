import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Meal, MealInput, MascotEvent, Profile } from '@nutrimapache/shared';

/**
 * Fase 1: los datos viven en el dispositivo (localStorage).
 * En la fase 2 este store pasa a ser una caché de la API, con la misma forma.
 */
interface State {
  profile: Profile | null;
  meals: Meal[];
  lastEvent: { event: MascotEvent; at: number } | null;
  setProfile: (p: Profile) => void;
  addMeal: (m: MealInput) => Meal;
  updateMeal: (id: string, m: Partial<MealInput>) => void;
  deleteMeal: (id: string) => void;
  emit: (event: MascotEvent) => void;
  wipe: () => void;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export const useStore = create<State>()(
  persist(
    (set) => ({
      profile: null,
      meals: [],
      lastEvent: null,
      setProfile: (profile) => set({ profile }),
      addMeal: (input) => {
        const now = new Date().toISOString();
        const meal: Meal = { ...input, id: uid(), createdAt: now, updatedAt: now };
        set((s) => ({ meals: [...s.meals, meal], lastEvent: { event: 'comida-registrada', at: Date.now() } }));
        return meal;
      },
      updateMeal: (id, patch) =>
        set((s) => ({
          meals: s.meals.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m)),
        })),
      deleteMeal: (id) => set((s) => ({ meals: s.meals.filter((m) => m.id !== id) })),
      emit: (event) => set({ lastEvent: { event, at: Date.now() } }),
      wipe: () => set({ profile: null, meals: [], lastEvent: null }),
    }),
    { name: 'nutrimapache', partialize: (s) => ({ profile: s.profile, meals: s.meals }) },
  ),
);

export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function localTime(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
