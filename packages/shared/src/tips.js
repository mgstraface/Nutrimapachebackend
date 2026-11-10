"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tipsFor = tipsFor;
const moved = (d) => d.status === 'como-plan' || (d.status === 'distinto' && d.activities.length > 0);
function tipsFor(ctx) {
    const { hour, profile, today } = ctx;
    const tips = [];
    const agua = { kind: 'agua', label: 'Sumar un vaso' };
    if (moved(today) && today.water < 4 && hour < 21) {
        tips.push({ id: 'agua-post', text: 'Después de moverte, el agua ayuda a recuperar. ¿Un vasito?', action: agua });
    }
    else if (hour >= 10 && hour < 21 && today.water === 0) {
        tips.push({ id: 'agua-0', text: '¿Arrancamos con un vaso de agua? 💧', action: agua });
    }
    else if (hour >= 15 && hour < 21 && today.water < 3) {
        tips.push({ id: 'agua-tarde', text: 'A esta altura de la tarde, un poco de agua viene bárbaro.', action: agua });
    }
    const caresMuscle = profile.goal === 'reduccion-gradual-conservando-musculo' || profile.goal === 'ganar-masa-muscular';
    if (caresMuscle && moved(today) && hour < 22) {
        tips.push({
            id: 'proteina-post',
            text: 'Si te pinta, sumá algo con proteína en la próxima comida (huevo, yogur, legumbres, pollo): ayuda a cuidar el músculo.',
        });
    }
    if (today.energy !== null && today.energy <= 2) {
        tips.push({ id: 'energia', text: 'Hoy tomalo con calma. Descansar también es parte del plan.' });
    }
    const vianda = /vianda/i.test(profile.workContext ?? '');
    if (vianda && hour >= 20) {
        tips.push({ id: 'vianda', text: '¿Dejamos pensada la vianda de mañana? Con algo de proteína y verdura, listo.' });
    }
    if (ctx.trainsTomorrowMorning && hour >= 21) {
        tips.push({ id: 'manana-entreno', text: 'Mañana temprano te toca moverte: dejar la ropa lista ayuda a arrancar sin vueltas.' });
    }
    return tips;
}
