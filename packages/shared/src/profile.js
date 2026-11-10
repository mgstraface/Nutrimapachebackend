"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEEKDAYS = exports.profileSchema = exports.bodySexSchema = exports.consentsSchema = exports.lookSchema = exports.viewPrefsSchema = exports.GOAL_LABELS = exports.goalSchema = exports.routineSchema = exports.momentSchema = exports.trainingTypeSchema = exports.mealSlotSchema = void 0;
exports.weekdayIndex = weekdayIndex;
const zod_1 = require("zod");
/** Una comida del día, definida por cada persona (2 a 6). */
exports.mealSlotSchema = zod_1.z.object({
    key: zod_1.z.string().regex(/^[a-z0-9-]{1,24}$/),
    label: zod_1.z.string().min(1).max(30),
    /** Hora aproximada "HH:MM", solo para ordenar y para el saludo de la mascota. */
    time: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
    emoji: zod_1.z.string().max(4).optional(),
});
exports.trainingTypeSchema = zod_1.z.object({
    key: zod_1.z.string().regex(/^[a-z0-9-]{1,24}$/),
    label: zod_1.z.string().min(1).max(30),
});
exports.momentSchema = zod_1.z.enum(['mañana', 'mediodía', 'tarde', 'noche']);
/**
 * Rutina semanal: índice 0 = lunes … 6 = domingo. trainingKey null = libre.
 * La primera actividad va en trainingKey/moment; si ese día hay más (ej. fuerza a la
 * mañana y bici a la tarde), van en "more".
 */
exports.routineSchema = zod_1.z.array(zod_1.z.object({
    trainingKey: zod_1.z.string().nullable(),
    moment: exports.momentSchema.nullable(),
    more: zod_1.z.array(zod_1.z.object({ trainingKey: zod_1.z.string(), moment: exports.momentSchema })).max(3).default([]),
})).length(7);
exports.goalSchema = zod_1.z.enum([
    'acompañar-habitos',
    'reduccion-gradual-conservando-musculo',
    'mantener',
    'ganar-masa-muscular',
    'mas-energia',
]);
exports.GOAL_LABELS = {
    'acompañar-habitos': 'Acompañar mis hábitos',
    'reduccion-gradual-conservando-musculo': 'Bajar de peso de a poco, cuidando el músculo',
    mantener: 'Mantenerme como estoy',
    'ganar-masa-muscular': 'Ganar masa muscular',
    'mas-energia': 'Tener más energía',
};
exports.viewPrefsSchema = zod_1.z.object({
    showCalories: zod_1.z.boolean().default(false),
    showMacros: zod_1.z.boolean().default(false),
    /** Soniditos de Cachete */
    sound: zod_1.z.boolean().default(true),
});
/** Lo que tiene puesto Cachete y lo que ya desbloqueó (nunca se pierde). */
exports.lookSchema = zod_1.z.object({
    head: zod_1.z.string().max(20).nullable().default(null),
    face: zod_1.z.string().max(20).nullable().default(null),
    neck: zod_1.z.string().max(20).nullable().default(null),
    ribbon: zod_1.z.string().max(20).nullable().default(null),
    unlocked: zod_1.z.array(zod_1.z.string().max(20)).max(50).default([]),
});
exports.consentsSchema = zod_1.z.object({
    photoStorage: zod_1.z.boolean().default(false),
    aiAnalysis: zod_1.z.boolean().default(false),
    acceptedAt: zod_1.z.string().datetime().nullable().default(null),
    version: zod_1.z.string().default('2026-11'),
});
/** Para la fórmula de gasto energético. "no-decir" usa un promedio. */
exports.bodySexSchema = zod_1.z.enum(['femenino', 'masculino', 'no-decir']);
exports.profileSchema = zod_1.z.object({
    displayName: zod_1.z.string().min(1).max(40),
    age: zod_1.z.number().int().min(14).max(110).optional(),
    heightCm: zod_1.z.number().min(120).max(230).optional(),
    weightKg: zod_1.z.number().min(30).max(300).optional(),
    sex: exports.bodySexSchema.optional(),
    goal: exports.goalSchema,
    workContext: zod_1.z.string().max(120).optional(),
    mealSlots: zod_1.z.array(exports.mealSlotSchema).min(2).max(6),
    trainingTypes: zod_1.z.array(exports.trainingTypeSchema).max(10),
    routine: exports.routineSchema,
    view: exports.viewPrefsSchema,
    consents: exports.consentsSchema,
    mascotName: zod_1.z.string().min(1).max(20).default('Cachete'),
    look: exports.lookSchema.default({}),
    /** Lo que hay en casa, para armar recetas */
    pantry: zod_1.z.array(zod_1.z.string().trim().min(1).max(40)).max(40).default([]),
});
exports.WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
/** Índice 0 = lunes para una fecha JS. */
function weekdayIndex(d) {
    return (d.getDay() + 6) % 7;
}
