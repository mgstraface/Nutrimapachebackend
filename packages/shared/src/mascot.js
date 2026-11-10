"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOODS = exports.FORBIDDEN_WORDS = exports.EXPRESSIONS = void 0;
exports.mascotState = mascotState;
exports.moodReply = moodReply;
/**
 * La mascota (Cachete) reacciona a eventos, hora y día de rutina.
 * Regla de diseño: el contenido nutricional de una comida NUNCA entra acá.
 */
exports.EXPRESSIONS = ['alegria', 'curiosidad', 'sorpresa', 'descanso', 'acompañamiento'];
/** Palabras que nunca pueden aparecer en una frase de la mascota. */
exports.FORBIDDEN_WORDS = ['mal', 'prohibid', 'compensar', 'culpa', 'te pasaste', 'racha perdida', 'fallaste', 'deberías'];
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
function mascotState(ctx, seed = Date.now()) {
    const n = ctx.displayName;
    const night = ctx.hour >= 21 || ctx.hour < 6;
    switch (ctx.event) {
        case 'comida-registrada':
            return { expression: 'alegria', phrase: pick(['¡Anotado! Gracias por contarme 💛', '¡Listo! Me encanta saber cómo va tu día.', '¡Guardado! Seguimos juntos.'], seed) };
        case 'foto-tomada':
            return { expression: 'curiosidad', phrase: pick(['Mmm, ¿qué tenemos acá?', 'A ver, a ver… qué rico se ve.'], seed) };
        case 'receta-nueva':
            return { expression: 'sorpresa', phrase: pick(['¡Una receta nueva! Quiero probarla.', '¡Ohh! Esa no la conocía.'], seed) };
        case 'entreno-registrado':
            return { expression: 'descanso', phrase: pick(['Buen trabajo. Ahora a recuperar energía.', 'Qué bien moverse. Respirá hondo.'], seed) };
        case 'energia-baja':
            return { expression: 'acompañamiento', phrase: pick(['Hay días así. Estoy acá con vos.', 'Gracias por contarme. Tomalo con calma hoy.'], seed) };
        case 'agua-registrada':
            return { expression: 'alegria', phrase: pick(['¡Glu glu! 💧', '¡Salud! Bien ahí con el agua.', 'Un vasito más, qué bien.'], seed) };
        case 'descanso-elegido':
            return { expression: 'descanso', phrase: pick(['Descansar también suma. Disfrutalo.', 'Hoy el cuerpo recupera. Bien elegido.'], seed) };
        case 'vuelta-tras-pausa':
            return { expression: 'acompañamiento', phrase: `¡Hola de nuevo, ${n}! ¿Arrancamos con lo que viene?` };
        case 'caricia':
            return pick([
                { expression: 'acompañamiento', phrase: `¡Hola, ${n}! 👋` },
                { expression: 'sorpresa', phrase: '¡Uy! Me sorprendiste 👋' },
                { expression: 'alegria', phrase: '¡Acá estoy!' },
            ], seed);
        case 'mimo':
            return { expression: 'alegria', phrase: pick(['Mmm, qué rico un mimo 💛', 'Ay, me encanta que me acaricies la cabeza.', 'Más, más… 🥰'], seed) };
        case 'cosquillas':
            return { expression: 'alegria', phrase: pick(['¡Jiji, cosquillas!', '¡Ja ja, ahí no! 🤭', '¡Basta que me hacés reír!'], seed) };
        case 'choca':
            return { expression: 'sorpresa', phrase: pick(['¡Chocá esos cinco! ✋', '¡Eso! Somos un equipo.', '¡Choque! ✨'], seed) };
        case 'cinta':
            return { expression: 'curiosidad', phrase: pick(['¡Uy, mi cintita! Me hacés hamacar.', 'Wiii, me balanceo 🎀', 'Cuidado que me colgás jiji.'], seed) };
        case 'abrazo':
            return { expression: 'alegria', phrase: pick([`Yo también te quiero, ${n} 💛`, 'Qué lindo abrazo. Me quedo acá un ratito.', 'Abrazo de oso… de muñeca 🤗'], seed) };
        case 'baile':
            return { expression: 'alegria', phrase: pick(['¡A bailar! 💃', '¡Pasito para acá, pasito para allá!', '¡Qué ritmo tenemos hoy!'], seed) };
        case 'mareo':
            return { expression: 'sorpresa', phrase: pick(['Wooo, me mareé 😵‍💫', '¡Todo da vueltas! Jiji.', 'Despacito que me mareo…'], seed) };
        case 'dormida':
            return { expression: 'descanso', phrase: pick(['Zzz… gracias por hamacarme…', 'Me quedé dormidita… 🌙', 'Shhh… sueño lindo…'], seed) };
        case 'arropada':
            return { expression: 'descanso', phrase: `Que descanses, ${n}. Mañana seguimos 🌙` };
        case 'notita-abierta':
            return { expression: 'alegria', phrase: pick(['¡Qué lindo mensaje! 💌', 'Te la guardo en tus notitas.'], seed) };
        case 'desbloqueo':
            return { expression: 'sorpresa', phrase: '¡Tengo algo nuevo para probarme! Tocá 👗' };
        case 'abrir-app':
        default: {
            if ((ctx.daysSinceLastLog ?? 0) >= 2) {
                return { expression: 'acompañamiento', phrase: `¡Hola de nuevo, ${n}! ¿Arrancamos con lo que viene?` };
            }
            if (night)
                return { expression: 'descanso', phrase: `Buenas noches, ${n}. Hoy fue un día más 🌙` };
            if (ctx.isRestDay)
                return { expression: 'descanso', phrase: `Día tranqui, ${n}. Disfrutalo.` };
            if (ctx.hour < 12)
                return { expression: 'alegria', phrase: `¡Buen día, ${n}! ¿Cómo arrancamos?` };
            if (ctx.hour < 19)
                return { expression: 'curiosidad', phrase: `¡Hola, ${n}! ¿Qué tal viene la tarde?` };
            return { expression: 'alegria', phrase: `¡Buenas, ${n}! ¿Cómo estuvo el día?` };
        }
    }
}
/* ---------------- ¿Cómo estás? ---------------- */
exports.MOODS = [
    { key: 'contenta', label: 'Contenta', emoji: '😊' },
    { key: 'tranqui', label: 'Tranqui', emoji: '😌' },
    { key: 'cansada', label: 'Cansada', emoji: '🥱' },
    { key: 'ansiosa', label: 'Ansiosa', emoji: '😟' },
    { key: 'triste', label: 'Bajoneada', emoji: '😔' },
];
/** Cachete acompaña: no aconseja ni corrige, solo está. */
function moodReply(mood, displayName, seed = 0) {
    switch (mood) {
        case 'contenta':
            return { expression: 'alegria', offerBreath: false, phrase: pick([`¡Qué lindo, ${displayName}! Me contagiás 💛`, '¡Eso me pone re contenta a mí también!'], seed) };
        case 'tranqui':
            return { expression: 'descanso', offerBreath: false, phrase: pick(['Qué bueno estar tranqui. Disfrutalo.', 'Me quedo acá con vos, tranquilas.'], seed) };
        case 'cansada':
            return { expression: 'acompañamiento', offerBreath: false, phrase: pick(['Hay días que cansan. Bajá un cambio cuando puedas.', 'Gracias por contarme. Un ratito de descanso te vendría bien.'], seed) };
        case 'ansiosa':
            return { expression: 'acompañamiento', offerBreath: true, phrase: pick(['Estoy acá. ¿Respiramos juntas un minuto?', 'Tranqui, de a poquito. Si querés, respiramos juntas.'], seed) };
        case 'triste':
        default:
            return { expression: 'acompañamiento', offerBreath: true, phrase: pick([`Te mando un abrazo grande, ${displayName}. Estoy con vos.`, 'Gracias por contarme. No tenés que estar bien todo el tiempo 💛'], seed) };
    }
}
