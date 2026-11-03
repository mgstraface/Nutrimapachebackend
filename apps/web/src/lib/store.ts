import { create } from 'zustand';
import { emptyDay, setFoods, type Food, type AnalysisQuota, type DayLog, type Meal, type MealInput, type MascotEvent, type Moments, type Note, type Profile, type SessionUser } from '@nutrimapache/shared';
import { setSoundEnabled } from './sound';
import { ApiError, api } from './api';

/**
 * Estado de la app. Los datos viven en el servidor (cuenta de cada usuaria);
 * este store es la copia en memoria de lo que devolvió la API.
 */
type Status = 'loading' | 'anon' | 'ready' | 'error';

interface Me {
  user: SessionUser;
  profile: Profile | null;
}

interface State {
  status: Status;
  bootError: string | null;
  user: SessionUser | null;
  profile: Profile | null;
  meals: Meal[];
  /** Días anotados (actividad, energía, agua), por fecha "YYYY-MM-DD" */
  days: Record<string, DayLog>;
  /** Funciones con IA disponibles (hay clave en el servidor) y uso de hoy */
  ai: AnalysisQuota | null;
  refreshAi: () => Promise<void>;
  /** Notitas por entregar y fechas especiales de hoy */
  moments: Moments;
  loadMoments: () => Promise<void>;
  openNote: (id: string) => Promise<Note | null>;
  lastEvent: { event: MascotEvent; at: number } | null;

  boot: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  addMeal: (m: MealInput) => Promise<Meal>;
  updateMeal: (id: string, m: Partial<MealInput>) => Promise<Meal>;
  deleteMeal: (id: string) => Promise<void>;
  /** Guarda cambios de un día; lo que no se pasa queda como estaba. */
  saveDay: (date: string, patch: Partial<Omit<DayLog, 'date' | 'updatedAt'>>) => Promise<void>;
  wipeData: () => Promise<void>;
  emit: (event: MascotEvent) => void;
}

// La versión anterior guardaba todo en el teléfono: limpiamos ese resto.
try {
  localStorage.removeItem('nutrimapache');
} catch {
  /* sin acceso a localStorage */
}

const DEFAULT_VIEW: Partial<Profile['view']> = { showCalories: false, showMacros: false };
const DEFAULT_LOOK: Partial<Profile['look']> = { head: null, face: null, neck: null, ribbon: null };

/** Perfiles guardados antes de que existieran algunos campos: se completan con valores por defecto. */
const withDefaults = (p: Profile | null): Profile | null =>
  p
    ? {
        ...p,
        view: { ...(DEFAULT_VIEW as Profile['view']), ...p.view, sound: p.view?.sound ?? true },
        look: { ...(DEFAULT_LOOK as Profile['look']), ...p.look, unlocked: p.look?.unlocked ?? [] },
      }
    : null;

const sortMeals = (meals: Meal[]) =>
  [...meals].sort((a, b) => (a.date === b.date ? (a.time ?? '').localeCompare(b.time ?? '') : b.date.localeCompare(a.date)));

export const useStore = create<State>()((set, get) => {
  const enter = async (me: Me) => {
    const from = localDate(new Date(Date.now() - 120 * 864e5));
    const [meals, dayList] = await Promise.all([api<Meal[]>('/meals'), api<DayLog[]>(`/days?from=${from}`)]);
    const days = Object.fromEntries(dayList.map((d) => [d.date, d]));
    set({ status: 'ready', bootError: null, user: me.user, profile: withDefaults(me.profile), meals: sortMeals(meals), days });
    setSoundEnabled(me.profile?.view.sound !== false);
    void get().refreshAi();
    void get().loadMoments();
    // Catálogo de alimentos editable por el admin (si falla, queda el que viene con la app)
    void api<Food[]>('/foods')
      .then((list) => list.length && setFoods(list))
      .catch(() => undefined);
  };

  return {
    status: 'loading',
    bootError: null,
    user: null,
    profile: null,
    meals: [],
    days: {},
    ai: null,
    moments: { notes: [], special: [] },
    lastEvent: null,

    loadMoments: async () => {
      try {
        set({ moments: await api<Moments>('/moments') });
      } catch {
        /* sin momentos: no pasa nada */
      }
    },

    openNote: async (id) => {
      const note = await api<Note | null>(`/notes/${id}/open`, { method: 'POST' });
      set((s) => ({ moments: { ...s.moments, notes: s.moments.notes.filter((n) => n.id !== id) } }));
      return note;
    },

    refreshAi: async () => {
      try {
        set({ ai: await api<AnalysisQuota>('/analysis/quota') });
      } catch {
        set({ ai: null });
      }
    },

    boot: async () => {
      set({ status: 'loading', bootError: null });
      try {
        await enter(await api<Me>('/auth/me'));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) set({ status: 'anon' });
        else set({ status: 'error', bootError: err instanceof Error ? err.message : String(err) });
      }
    },

    login: async (username, password) => {
      const me = await api<Me>('/auth/login', { method: 'POST', body: { username, password } });
      await enter(me);
      set({ lastEvent: { event: 'abrir-app', at: Date.now() } });
    },

    logout: async () => {
      try {
        await api('/auth/logout', { method: 'POST' });
      } finally {
        set({ status: 'anon', user: null, profile: null, meals: [], days: {}, lastEvent: null });
      }
    },

    saveProfile: async (p) => {
      const profile = await api<Profile>('/profile', { method: 'PUT', body: p });
      setSoundEnabled(profile.view.sound !== false);
      set({ profile: withDefaults(profile) });
    },

    addMeal: async (input) => {
      const meal = await api<Meal>('/meals', { method: 'POST', body: input });
      set((s) => ({ meals: sortMeals([...s.meals, meal]), lastEvent: { event: 'comida-registrada', at: Date.now() } }));
      return meal;
    },

    updateMeal: async (id, patch) => {
      const meal = await api<Meal>(`/meals/${id}`, { method: 'PATCH', body: patch });
      set((s) => ({ meals: sortMeals(s.meals.map((m) => (m.id === id ? meal : m))) }));
      return meal;
    },

    deleteMeal: async (id) => {
      await api(`/meals/${id}`, { method: 'DELETE' });
      set((s) => ({ meals: s.meals.filter((m) => m.id !== id) }));
    },

    saveDay: async (date, patch) => {
      const prev = get().days[date] ?? emptyDay(date);
      const next: DayLog = { ...prev, ...patch, date };
      // Optimista: se ve al instante; si falla, vuelve atrás y avisa.
      set((s) => ({ days: { ...s.days, [date]: next } }));
      try {
        const { date: _d, updatedAt: _u, ...body } = next;
        const saved = await api<DayLog>(`/days/${date}`, { method: 'PUT', body });
        // Si mientras tanto hubo otro toque (ej. varios vasos seguidos), gana el más nuevo.
        if (get().days[date] === next) set((s) => ({ days: { ...s.days, [date]: saved } }));
      } catch (err) {
        if (get().days[date] === next) set((s) => ({ days: { ...s.days, [date]: prev } }));
        throw err;
      }
    },

    wipeData: async () => {
      await api('/privacy/data', { method: 'DELETE' });
      set({ profile: null, meals: [], days: {}, lastEvent: null });
    },

    emit: (event) => set({ lastEvent: { event, at: Date.now() } }),
  };
});

/** Para chequeos puntuales fuera de React. */
export const getUser = () => useStore.getState().user;

export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function localTime(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
