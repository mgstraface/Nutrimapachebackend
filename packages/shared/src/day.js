"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyDay = exports.dayLogSchema = exports.dayStatusSchema = exports.activitySchema = exports.ACTIVITY_KINDS = void 0;
exports.plannedFor = plannedFor;
exports.summarizeDay = summarizeDay;
exports.formatMinutes = formatMinutes;
const zod_1 = require("zod");
const profile_1 = require("./profile");
/** Actividades comunes para anotar algo distinto a la rutina, en un toque. */
exports.ACTIVITY_KINDS = [
    { key: 'caminata', label: 'Caminata', emoji: '🚶‍♀️' },
    { key: 'bici', label: 'Bici', emoji: '🚲' },
    { key: 'fuerza', label: 'Fuerza', emoji: '🏋️‍♀️' },
    { key: 'correr', label: 'Correr', emoji: '🏃‍♀️' },
    { key: 'yoga', label: 'Yoga / estirar', emoji: '🧘‍♀️' },
    { key: 'natacion', label: 'Natación', emoji: '🏊‍♀️' },
    { key: 'baile', label: 'Baile', emoji: '💃' },
    { key: 'otro', label: 'Otra cosa', emoji: '✨' },
];
exports.activitySchema = zod_1.z.object({
    /** key de ACTIVITY_KINDS o de un trainingType del perfil */
    kind: zod_1.z.string().min(1).max(30),
    label: zod_1.z.string().min(1).max(40),
    minutes: zod_1.z.number().int().min(1).max(600).optional(),
    /** 1 = suave · 5 = a pleno */
    intensity: zod_1.z.number().int().min(1).max(5).optional(),
});
/**
 * Cómo fue la actividad del día respecto de la rutina:
 * - como-plan: hizo lo que tocaba
 * - distinto: hizo otra cosa (ver activities)
 * - descanso: decidió descansar (siempre válido, sin culpa)
 * Sin estado = no anotó nada, y eso también está bien.
 */
exports.dayStatusSchema = zod_1.z.enum(['como-plan', 'distinto', 'descanso']);
exports.dayLogSchema = zod_1.z.object({
    status: exports.dayStatusSchema.nullable().default(null),
    activities: zod_1.z.array(exports.activitySchema).max(10).default([]),
    energy: zod_1.z.number().int().min(1).max(5).nullable().default(null),
    water: zod_1.z.number().int().min(0).max(30).default(0),
    note: zod_1.z.string().max(280).default(''),
    /** ¿Cómo estás? (opcional) */
    mood: zod_1.z.enum(['contenta', 'tranqui', 'cansada', 'ansiosa', 'triste']).nullable().default(null),
});
const emptyDay = (date) => ({ date, status: null, activities: [], energy: null, water: 0, note: '', mood: null });
exports.emptyDay = emptyDay;
/** Lo que tocaba según la rutina para esa fecha (o null si era día libre). */
function plannedFor(profile, date) {
    const r = profile.routine[(0, profile_1.weekdayIndex)(date)];
    if (!r?.trainingKey)
        return null;
    const sessions = [{ trainingKey: r.trainingKey, moment: r.moment }, ...(r.more ?? [])]
        .map((s) => {
        const t = profile.trainingTypes.find((x) => x.key === s.trainingKey);
        return t ? { key: t.key, label: t.label, moment: s.moment ?? null } : null;
    })
        .filter((s) => s !== null);
    if (!sessions.length)
        return null;
    if (sessions.length === 1)
        return { ...sessions[0], sessions };
    return {
        key: sessions[0].key,
        label: sessions.map((s) => (s.moment ? `${s.label} (${s.moment})` : s.label)).join(' + '),
        moment: null,
        sessions,
    };
}
/** Texto corto para chips e historial. */
function summarizeDay(day, planned) {
    if (!day?.status)
        return null;
    if (day.status === 'descanso')
        return 'Descanso';
    if (day.status === 'como-plan')
        return planned ? `${planned.label} ✓` : 'Actividad ✓';
    const parts = day.activities.map((a) => (a.minutes ? `${a.label} ${formatMinutes(a.minutes)}` : a.label));
    return parts.length ? parts.join(' + ') : 'Otra actividad';
}
function formatMinutes(min) {
    if (min < 60)
        return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
}
