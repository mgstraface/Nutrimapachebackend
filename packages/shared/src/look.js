"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accessoryByKey = exports.SLOT_LABELS = exports.ACCESSORIES = void 0;
exports.usageStats = usageStats;
exports.newUnlocks = newUnlocks;
exports.ACCESSORIES = [
    { key: 'flores', slot: 'ribbon', label: 'Flores en la cinta', emoji: '🌼', how: 'Anotá tu primera comida', unlocked: (s) => s.meals >= 1 },
    { key: 'mono', slot: 'ribbon', label: 'Moñito', emoji: '🎀', how: 'Anotá algo en 3 días distintos', unlocked: (s) => s.daysLogged >= 3 },
    { key: 'lentes', slot: 'face', label: 'Lentes de sol', emoji: '🕶️', how: 'Anotá tu movimiento 3 días', unlocked: (s) => s.movedDays >= 3 },
    { key: 'bufanda', slot: 'neck', label: 'Bufanda tejida', emoji: '🧣', how: 'Sumá 20 vasos de agua en total', unlocked: (s) => s.water >= 20 },
    { key: 'lana', slot: 'head', label: 'Gorrito de lana', emoji: '🧶', how: 'Anotá 15 comidas', unlocked: (s) => s.meals >= 15 },
    { key: 'poncho', slot: 'neck', label: 'Ponchito', emoji: '🪢', how: 'Anotá algo en 10 días distintos', unlocked: (s) => s.daysLogged >= 10 },
    { key: 'camara', slot: 'face', label: 'Lupa curiosa', emoji: '🔍', how: 'Anotá una comida con foto', unlocked: (s) => s.photoMeals >= 1 },
    { key: 'corona', slot: 'head', label: 'Corona de flores', emoji: '💐', how: 'Anotá 40 comidas', unlocked: (s) => s.meals >= 40 },
];
exports.SLOT_LABELS = { head: 'Cabeza', face: 'Cara', neck: 'Cuello', ribbon: 'Cinta' };
function usageStats(meals, days) {
    const dates = new Set(meals.map((m) => m.date));
    let water = 0;
    let movedDays = 0;
    let moodDays = 0;
    for (const d of Object.values(days)) {
        water += d.water;
        if (d.status === 'como-plan' || d.status === 'distinto')
            movedDays++;
        if (d.mood)
            moodDays++;
        if (d.status || d.water > 0 || d.mood || d.energy !== null)
            dates.add(d.date);
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
function newUnlocks(look, stats) {
    return exports.ACCESSORIES.filter((a) => !look.unlocked.includes(a.key) && a.unlocked(stats));
}
const accessoryByKey = (key) => exports.ACCESSORIES.find((a) => a.key === key);
exports.accessoryByKey = accessoryByKey;
