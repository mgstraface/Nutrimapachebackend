import type { Profile } from './profile';

/**
 * Plantillas para arrancar un perfil. Nada de esto está fijo en la app:
 * al crear una cuenta se elige una plantilla o se arranca de cero, y todo se edita.
 */
export interface ProfileTemplate {
  id: string;
  title: string;
  description: string;
  profile: Omit<Profile, 'displayName' | 'consents'>;
}

const DEFAULT_VIEW = { showCalories: false, showMacros: false };

export const FOUR_MEALS = [
  { key: 'desayuno', label: 'Desayuno', time: '07:30', emoji: '☕' },
  { key: 'almuerzo', label: 'Almuerzo', time: '13:00', emoji: '🥗' },
  { key: 'merienda', label: 'Merienda', time: '17:00', emoji: '🍎' },
  { key: 'cena', label: 'Cena', time: '21:00', emoji: '🍲' },
];

export const PROFILE_TEMPLATES: ProfileTemplate[] = [
  {
    id: 'sara',
    title: 'Entreno de mañana + vianda',
    description: '4 comidas, fuerza y bici cuatro mañanas, bici los miércoles. Trabajo sentada con vianda.',
    profile: {
      age: 32,
      goal: 'reduccion-gradual-conservando-musculo',
      workContext: 'Trabajo sentada, llevo vianda al almuerzo',
      mealSlots: FOUR_MEALS,
      trainingTypes: [
        { key: 'fuerza-bici', label: 'Fuerza + bici' },
        { key: 'bici', label: 'Bici' },
      ],
      routine: [
        { trainingKey: 'fuerza-bici', moment: 'mañana' },
        { trainingKey: 'fuerza-bici', moment: 'mañana' },
        { trainingKey: 'bici', moment: 'mañana' },
        { trainingKey: 'fuerza-bici', moment: 'mañana' },
        { trainingKey: 'fuerza-bici', moment: 'mañana' },
        { trainingKey: null, moment: null },
        { trainingKey: null, moment: null },
      ],
      view: DEFAULT_VIEW,
      mascotName: 'Mapi',
    },
  },
  {
    id: 'blank',
    title: 'Empezar de cero',
    description: '4 comidas y sin rutina de entrenamiento. Después ajustás todo.',
    profile: {
      goal: 'acompañar-habitos',
      mealSlots: FOUR_MEALS,
      trainingTypes: [],
      routine: Array.from({ length: 7 }, () => ({ trainingKey: null, moment: null })),
      view: DEFAULT_VIEW,
      mascotName: 'Mapi',
    },
  },
];
