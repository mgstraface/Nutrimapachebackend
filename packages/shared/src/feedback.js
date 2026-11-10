"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dayContext = dayContext;
exports.mealFeedback = mealFeedback;
exports.remainingTarget = remainingTarget;
exports.dayFeedback = dayFeedback;
const range_1 = require("./range");
const energy_1 = require("./energy");
const mid = (r) => (r.min + r.max) / 2;
const round10 = (n) => Math.round(n / 10) * 10;
const round50 = (n) => Math.round(n / 50) * 50;
const add = (a, b) => ({ min: a.min + b.min, max: a.max + b.max });
const ZERO = { min: 0, max: 0 };
const toMin = (t) => (t && /^\d{2}:\d{2}$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);
/** Momentos del día ordenados por hora (por si el perfil no los tiene en orden). */
function orderedSlots(profile) {
    return profile.mealSlots
        .map((s, i) => ({ ...s, i }))
        .sort((a, b) => (toMin(a.time) ?? a.i * 240) - (toMin(b.time) ?? b.i * 240));
}
/** ¿Esta otra comida del día fue antes (o en el mismo momento) que la que se está mirando? */
function cameBefore(profile, order, other, slotKey, time) {
    const mine = order.indexOf(slotKey);
    const theirs = order.indexOf(other.slotKey);
    if (mine >= 0 && theirs >= 0)
        return theirs <= mine;
    // Una de las dos es "extra" (fuera de los momentos del perfil): se decide por la hora.
    const myTime = toMin(time) ?? toMin(profile.mealSlots.find((s) => s.key === slotKey)?.time);
    const theirTime = toMin(other.time) ?? toMin(profile.mealSlots.find((s) => s.key === other.slotKey)?.time);
    if (myTime === null || theirTime === null)
        return true;
    return theirTime <= myTime;
}
/** Calorías de una comida anotada; si no tiene cantidades, las de una comida típica de ese momento. */
function mealKcal(profile, energy, m) {
    const k = (0, range_1.sumRanges)(m.items.map((i) => i.kcal));
    if (k)
        return k;
    return profile.mealSlots.some((s) => s.key === m.slotKey) ? (0, energy_1.mealTarget)(profile, m.slotKey, energy).kcal : ZERO;
}
function dayContext(profile, energy, slotKey, thisKcal, others, time) {
    const slots = orderedSlots(profile);
    const order = slots.map((s) => s.key);
    const before = others.filter((m) => cameBefore(profile, order, m, slotKey, time));
    const soFar = before.reduce((acc, m) => add(acc, mealKcal(profile, energy, m)), thisKcal);
    // Lo esperable hasta acá: los momentos hasta este inclusive. Un "extra" suma lo de los momentos que ya pasaron por hora.
    const idx = order.indexOf(slotKey);
    const myTime = toMin(time);
    const upTo = idx >= 0 ? slots.slice(0, idx + 1) : slots.filter((s) => myTime === null || (toMin(s.time) ?? 0) <= myTime);
    const expected = upTo.reduce((acc, s) => add(acc, (0, energy_1.mealTarget)(profile, s.key, energy).kcal), ZERO);
    const s = mid(soFar);
    const balance = s > expected.max * 1.1 ? 'adelante' : s < expected.min * 0.8 ? 'atras' : 'en-linea';
    const remaining = { min: Math.max(0, energy.kcal.min - soFar.max), max: Math.max(0, energy.kcal.max - soFar.min) };
    return { soFar, expected, day: energy.kcal, remaining, balance, counted: before.length };
}
/**
 * "Miradita" de una comida. Antes de opinar se fija cuánto va acumulado en el día:
 * una merienda más cargada después de un almuerzo liviano no es "generosa", el día viene equilibrado.
 * numbers=false: misma devolución pero sin cifras (para quien eligió no ver calorías).
 * others: las demás comidas de ese mismo día (sin esta).
 */
function mealFeedback(profile, slotKey, items, numbers = true, others = [], time) {
    const kcal = (0, range_1.sumRanges)(items.map((i) => i.kcal));
    const protein = (0, range_1.sumRanges)(items.map((i) => i.protein));
    const groups = [...new Set(items.map((i) => i.group))];
    const energy = (0, energy_1.estimateEnergy)(profile);
    const slot = profile.mealSlots.find((s) => s.key === slotKey);
    const slotName = slot ? slot.label.toLowerCase() : 'esta comida';
    const target = energy && slot ? (0, energy_1.mealTarget)(profile, slotKey, energy) : undefined;
    const suggestions = [];
    const hasPlant = groups.includes('verdura') || groups.includes('fruta');
    const caresMuscle = profile.goal === 'reduccion-gradual-conservando-musculo' || profile.goal === 'ganar-masa-muscular';
    if (!kcal || !target || !energy) {
        if (!hasPlant && items.length > 0)
            suggestions.push('Una verdura o una fruta al lado suma fibra y saciedad.');
        return {
            level: 'sin-datos',
            kcal,
            protein,
            target,
            groups,
            headline: !kcal ? '¡Anotada! Si cargás cantidades, te cuento más de esta comida.' : '¡Anotada! Completá tus datos en Yo y te digo cómo viene para tu objetivo.',
            suggestions,
        };
    }
    const day = dayContext(profile, energy, slotKey, kcal, others, time);
    const m = mid(kcal);
    const slotHigh = m > target.kcal.max * 1.1;
    const slotLow = m < target.kcal.min * 0.75;
    const isLast = orderedSlots(profile).at(-1)?.key === slotKey;
    const left = numbers && !isLast && day.remaining.max > 0 ? ` Te quedan ≈ ${round50(mid(day.remaining))} kcal para el resto del día.` : '';
    let level = 'dentro';
    let headline;
    if (slotHigh && day.balance !== 'adelante') {
        // Más cargada que lo típico para este momento, pero el día viene bien: no es para marcar.
        headline =
            day.counted > 0
                ? `Más cargadita de lo habitual para ${slotName}, pero con lo que comiste antes el día viene bien equilibrado 👌${left}`
                : `Más cargadita de lo habitual para ${slotName}, y el día recién arranca: está todo bien 👌${left}`;
    }
    else if (slotHigh) {
        level = 'generosa';
        const diff = round10(mid(day.soFar) - day.expected.max);
        headline = `Vino un poquito más generosa para ${slotName} y el día ya viene completito${numbers && diff > 0 ? ` (≈ +${diff} kcal sobre lo esperable a esta altura)` : ''}. Nada grave: se acomoda solo con las próximas comidas.`;
        if (!isLast)
            suggestions.push('Para la próxima comida, algo con verdura y proteína te va a caer bárbaro.');
    }
    else if (slotLow && day.balance === 'atras') {
        level = 'liviana';
        headline = `Quedó livianita para ${slotName}, y el día viene liviano también. Si te quedás con hambre, sumá algo: comer bien también es parte.`;
    }
    else if (slotLow) {
        headline = `Livianita, pero con lo que comiste antes está bien así. Si te da hambre, sumá algo sin drama.${left}`;
    }
    else {
        headline = `Bien equilibrada para ${slotName} 👌${left}`;
    }
    if (protein && mid(protein) < target.protein.min * 0.7) {
        suggestions.push(caresMuscle
            ? 'Sumarle una porción de proteína (huevo, yogur, legumbres, pollo, atún) ayuda a cuidar el músculo.'
            : 'Una porción de proteína (huevo, yogur, legumbres) te ayuda a quedar satisfecha más tiempo.');
    }
    if (!hasPlant)
        suggestions.push('Una verdura o una fruta al lado suma fibra y saciedad.');
    return { level, kcal, protein, target, day, groups, headline, suggestions: suggestions.slice(0, 2) };
}
/**
 * Rango para una comida que todavía no se hizo (ideas, recetas), ajustado a lo que ya se comió en el día:
 * lo que queda del rango diario se reparte entre esta comida y las que faltan, según su peso habitual.
 * Se queda entre el 70 % y el 160 % del rango típico: nunca empuja a comer muy poco ni a "recuperar".
 */
function remainingTarget(profile, slotKey, energy, dayMeals) {
    const base = (0, energy_1.mealTarget)(profile, slotKey, energy);
    const others = dayMeals.filter((m) => m.slotKey !== slotKey);
    if (!others.length)
        return base;
    const logged = new Set(others.map((m) => m.slotKey));
    const pending = profile.mealSlots.filter((s) => s.key === slotKey || !logged.has(s.key));
    const weightOf = (key) => mid((0, energy_1.mealTarget)(profile, key, energy).kcal);
    const share = weightOf(slotKey) / pending.reduce((n, s) => n + weightOf(s.key), 0);
    const eaten = others.reduce((acc, m) => add(acc, mealKcal(profile, energy, m)), ZERO);
    const eatenProt = others.reduce((acc, m) => add(acc, (0, range_1.sumRanges)(m.items.map((i) => i.protein)) ?? ZERO), ZERO);
    const clamp = (v, b) => Math.min(b.max * 1.6, Math.max(b.min * 0.7, v));
    const kMin = round50(clamp((energy.kcal.min - mid(eaten)) * share, base.kcal));
    const kMax = Math.max(round50(clamp((energy.kcal.max - mid(eaten)) * share, base.kcal)), kMin + 50);
    const pMin = Math.round(clamp((energy.protein.min - mid(eatenProt)) * share, base.protein) / 5) * 5;
    const pMax = Math.max(Math.round(clamp((energy.protein.max - mid(eatenProt)) * share, base.protein) / 5) * 5, pMin + 5);
    return { kcal: { min: kMin, max: kMax }, protein: { min: pMin, max: pMax } };
}
/** Resumen suave del día con lo anotado hasta ahora. */
function dayFeedback(profile, items, hour) {
    const energy = (0, energy_1.estimateEnergy)(profile);
    if (!energy)
        return null;
    const kcal = (0, range_1.sumRanges)(items.map((i) => i.kcal));
    const protein = (0, range_1.sumRanges)(items.map((i) => i.protein));
    const progress = kcal ? mid(kcal) / mid(energy.kcal) : 0;
    let line;
    if (!kcal)
        line = 'Cuando anotes comidas con cantidades, acá vas a ver cómo viene el día.';
    else if (mid(kcal) > energy.kcal.max * 1.1)
        line = 'Hoy vino un día generoso. Tranqui: un día no define nada, mañana seguimos con lo de siempre 💛';
    else if (hour >= 20 && mid(kcal) < energy.kcal.min * 0.7)
        line = 'Hoy fue un día más liviano. Si tenés hambre, comé algo rico antes de dormir.';
    else if (mid(kcal) >= energy.kcal.min)
        line = 'Ya estás dentro de tu rango del día 👌';
    else
        line = 'Vas bien. Lo que falta del día lo vas completando con tus comidas.';
    return { energy, kcal, protein, progress, line };
}
