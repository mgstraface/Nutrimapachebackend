"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROFILE_TEMPLATES = exports.FOUR_MEALS = void 0;
const DEFAULT_VIEW = { showCalories: false, showMacros: false, sound: true };
const DEFAULT_LOOK = { head: null, face: null, neck: null, ribbon: null, unlocked: [] };
exports.FOUR_MEALS = [
    { key: 'desayuno', label: 'Desayuno', time: '07:30', emoji: '☕' },
    { key: 'almuerzo', label: 'Almuerzo', time: '13:00', emoji: '🥗' },
    { key: 'merienda', label: 'Merienda', time: '17:00', emoji: '🍎' },
    { key: 'cena', label: 'Cena', time: '21:00', emoji: '🍲' },
];
exports.PROFILE_TEMPLATES = [
    {
        id: 'sara',
        title: 'Entreno de mañana + vianda',
        description: '4 comidas, fuerza y bici cuatro mañanas, bici los miércoles. Trabajo sentada con vianda.',
        profile: {
            age: 32,
            goal: 'reduccion-gradual-conservando-musculo',
            workContext: 'Trabajo sentada, llevo vianda al almuerzo',
            mealSlots: exports.FOUR_MEALS,
            trainingTypes: [
                { key: 'fuerza-bici', label: 'Fuerza + bici' },
                { key: 'bici', label: 'Bici' },
            ],
            routine: [
                { trainingKey: 'fuerza-bici', moment: 'mañana', more: [] },
                { trainingKey: 'fuerza-bici', moment: 'mañana', more: [] },
                { trainingKey: 'bici', moment: 'mañana', more: [] },
                { trainingKey: 'fuerza-bici', moment: 'mañana', more: [] },
                { trainingKey: 'fuerza-bici', moment: 'mañana', more: [] },
                { trainingKey: null, moment: null, more: [] },
                { trainingKey: null, moment: null, more: [] },
            ],
            view: DEFAULT_VIEW,
            mascotName: 'Cachete',
            look: DEFAULT_LOOK,
            pantry: [],
        },
    },
    {
        id: 'blank',
        title: 'Empezar de cero',
        description: '4 comidas y sin rutina de entrenamiento. Después ajustás todo.',
        profile: {
            goal: 'acompañar-habitos',
            mealSlots: exports.FOUR_MEALS,
            trainingTypes: [],
            routine: Array.from({ length: 7 }, () => ({ trainingKey: null, moment: null, more: [] })),
            view: DEFAULT_VIEW,
            mascotName: 'Cachete',
            look: DEFAULT_LOOK,
            pantry: [],
        },
    },
];
