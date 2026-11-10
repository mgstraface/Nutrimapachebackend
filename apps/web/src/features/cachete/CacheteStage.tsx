import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ACCESSORIES,
  moodReply,
  newUnlocks,
  specialPhrase,
  usageStats,
  addDays,
  weekStart,
  weekSummary,
  type DayLog,
  type Expression,
  type MascotEvent,
  type Mood,
  type Note,
} from '@nutrimapache/shared';
import { Cachete, zoneAt, type CacheteAction, type CacheteLook } from '../../mascot/Cachete';
import { useCacheteGestures, type Gesture } from '../../mascot/useCacheteGestures';
import { useShake } from '../../mascot/useShake';
import { errorText } from '../../lib/api';
import { play, type SoundKind } from '../../lib/sound';
import { useStore } from '../../lib/store';
import { BreathSheet } from './BreathSheet';
import { GesturesSheet } from './GesturesSheet';
import { LookSheet } from './LookSheet';
import { MoodSheet } from './MoodSheet';
import { NoteModal } from './NoteModal';

interface Props {
  base: { expression: Expression; phrase: string };
  /** La frase base viene de algo que acaba de pasar (comida anotada, agua…): tiene prioridad */
  baseIsEvent: boolean;
  today: string;
  day: DayLog;
  now: Date;
}

const ACTION_MS: Partial<Record<CacheteAction, number>> = {
  dormida: 9000,
  baile: 3200,
  abrazo: 2800,
  mareo: 3200,
  sacudida: 3400,
  risa: 3600,
  rascar: 2400,
  cachetes: 1900,
  nam: 2600,
  sorbo: 2700,
  bostezo: 2300,
  estira: 1900,
  mira: 2500,
  juega: 1300,
  festejo: 4300,
};

/** Las reacciones y la vida propia no cambian la frase: solo se mueve. */
const ACTION_EVENT: Partial<Record<CacheteAction, MascotEvent>> = {
  mimo: 'mimo',
  cosquillas: 'cosquillas',
  'choca-izq': 'choca',
  'choca-der': 'choca',
  cinta: 'cinta',
  saludo: 'caricia',
  abrazo: 'abrazo',
  baile: 'baile',
  mareo: 'mareo',
  dormida: 'dormida',
  cachetes: 'cachetes',
  rascar: 'rascar',
  risa: 'risa',
  sacudida: 'sacudida',
  festejo: 'festejo',
};

/** Los movimientos sueltos (bostezo, mirar…) van en silencio para no molestar. */
const ACTION_SOUND: Partial<Record<CacheteAction, SoundKind>> = {
  mimo: 'mimo',
  cosquillas: 'risita',
  'choca-izq': 'choca',
  'choca-der': 'choca',
  cinta: 'boing',
  saludo: 'hola',
  abrazo: 'abrazo',
  baile: 'baile',
  mareo: 'mareo',
  dormida: 'bostezo',
  cachetes: 'pop',
  rascar: 'rasca',
  risa: 'risa',
  sacudida: 'mareo',
  festejo: 'festejo',
  nam: 'nam',
};

/** Cosas que hace sola cuando nadie la toca. */
const IDLE: CacheteAction[] = ['mira', 'estira', 'juega', 'bostezo', 'mira'];
const idleDelay = () => 14000 + Math.random() * 14000;
const TICKLE_WINDOW_MS = 4000;
const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* sin localStorage */
  }
};

/** Cachete viva: gestos, accesorios, notitas, fechas especiales, ánimo y ratitos de calma. */
export function CacheteStage({ base, baseIsEvent, today, day, now }: Props) {
  const profile = useStore((s) => s.profile)!;
  const meals = useStore((s) => s.meals);
  const days = useStore((s) => s.days);
  const moments = useStore((s) => s.moments);
  const emit = useStore((s) => s.emit);
  const saveDay = useStore((s) => s.saveDay);
  const saveProfile = useStore((s) => s.saveProfile);
  const openNote = useStore((s) => s.openNote);
  const lastEvent = useStore((s) => s.lastEvent);

  const [action, setAction] = useState<CacheteAction | null>(null);
  const actionTimer = useRef<ReturnType<typeof setTimeout>>();
  const [override, setOverride] = useState<{ expression: Expression; phrase: string; until: number } | null>(null);
  const [lookOpen, setLookOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [breathOpen, setBreathOpen] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [offerBreath, setOfferBreath] = useState(false);
  const [newLook, setNewLook] = useState(() => lsGet('cn_look_new') === '1');
  const [arropada, setArropada] = useState(() => lsGet(`cn_arropada_${today}`) === '1');
  const [confetti, setConfetti] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const actionRef = useRef<CacheteAction | null>(null);
  const lastTouch = useRef(Date.now());
  const nextIdle = useRef(idleDelay());
  const tickles = useRef<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const hour = now.getHours();
  const night = hour >= 21 || hour < 6;
  const month = now.getMonth() + 1;
  const special = moments.special[0];
  const pendingNote = moments.notes[0];

  useEffect(() => () => clearTimeout(actionTimer.current), []);

  // Confeti unos segundos al abrir en un día especial
  useEffect(() => {
    if (!special) return;
    setConfetti(true);
    play('carta');
    const t = setTimeout(() => setConfetti(false), 8000);
    return () => clearTimeout(t);
  }, [special?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Accesorios nuevos: se guardan desbloqueados para siempre y Cachete lo cuenta
  const unlocking = useRef(false);
  useEffect(() => {
    if (unlocking.current) return;
    const fresh = newUnlocks(profile.look, usageStats(meals, days));
    if (!fresh.length) return;
    unlocking.current = true;
    saveProfile({ ...profile, look: { ...profile.look, unlocked: [...profile.look.unlocked, ...fresh.map((a) => a.key)] } })
      .then(() => {
        setNewLook(true);
        lsSet('cn_look_new', '1');
        emit('desbloqueo');
        play('carta');
      })
      .catch(() => {
        /* se reintenta en la próxima carga */
      })
      .finally(() => {
        unlocking.current = false;
      });
  }, [meals.length, Object.keys(days).length, profile.look.unlocked.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lo que tiene puesto: lo elegido + gorrito de dormir de noche, de fiesta en días especiales, bufanda en invierno
  const look: CacheteLook = {
    ...profile.look,
    head: special ? 'fiesta' : night ? 'noche' : profile.look.head,
    neck: profile.look.neck ?? (month >= 6 && month <= 8 ? 'bufanda' : null),
  };
  const showBlanket = arropada && night && !action;
  // Arropada de noche no hace cositas sola: la dejamos dormir
  const restingRef = useRef(false);
  restingRef.current = arropada && night;

  /** idle = la hace sola (no cuenta como interacción ni suena). */
  const doAction = (a: CacheteAction, idle = false) => {
    clearTimeout(actionTimer.current);
    setAction(a);
    actionRef.current = a;
    const event = ACTION_EVENT[a];
    if (event) {
      setOverride(null);
      emit(event);
    }
    const sound = ACTION_SOUND[a];
    if (sound && !idle) play(sound);
    if (!idle) {
      lastTouch.current = Date.now();
      nextIdle.current = idleDelay();
    }
    actionTimer.current = setTimeout(() => {
      setAction(null);
      actionRef.current = null;
    }, ACTION_MS[a] ?? 2600);
  };

  // Sacudir el celu → se marea
  const shake = useShake(() => doAction('sacudida'));

  // Reacciona a lo que se anota: igual para cualquier comida (nunca se juzga qué se comió)
  useEffect(() => {
    if (!lastEvent || Date.now() - lastEvent.at > 3000) return;
    if (lastEvent.event === 'comida-registrada') doAction('nam', true);
    else if (lastEvent.event === 'agua-registrada') doAction('sorbo', true);
  }, [lastEvent?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  // Vida propia: si nadie la toca un rato, hace sus cositas
  useEffect(() => {
    if (reducedMotion()) return;
    const t = setInterval(() => {
      if (actionRef.current || restingRef.current || document.visibilityState !== 'visible') return;
      if (Date.now() - lastTouch.current < nextIdle.current) return;
      const h = new Date().getHours();
      const sleepy = h >= 21 || h < 7 || (h >= 14 && h < 16);
      const pool = sleepy ? [...IDLE, 'bostezo', 'bostezo'] : IDLE;
      lastTouch.current = Date.now();
      nextIdle.current = idleDelay();
      doAction(pool[Math.floor(Math.random() * pool.length)] as CacheteAction, true);
    }, 3000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Festejo: la primera vez que se abre en la semana, si la anterior cerró pareja
  useEffect(() => {
    const lastMonday = addDays(weekStart(today), -7);
    const key = `cn_festejo_${lastMonday}`;
    if (lsGet(key)) return;
    const w = weekSummary(profile, meals, today, false, lastMonday);
    if (!w || w.loggedDays < 4) return;
    lsSet(key, '1');
    if (w.level === 'en-linea' || (w.level === 'margen' && !w.care)) {
      const t = setTimeout(() => doAction('festejo'), 1500);
      return () => clearTimeout(t);
    }
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps

  const deliverNote = async () => {
    if (!pendingNote) return;
    play('carta');
    setNote(pendingNote);
    try {
      await openNote(pendingNote.id);
    } catch {
      /* se marca la próxima vez */
    }
  };

  const onGesture = (g: Gesture) => {
    if (pendingNote && g.kind !== 'rock') {
      void deliverNote();
      return;
    }
    if (g.kind === 'double') {
      // Toques rápidos en la panza son cosquillas (dos), no baile: así sale el ataque de risa
      if (zoneAt(g.x, g.y, base.expression, action) === 'panza') {
        const now = Date.now();
        tickles.current = [...tickles.current.filter((t) => now - t < TICKLE_WINDOW_MS), now, now];
        if (tickles.current.length >= 3) {
          tickles.current = [];
          return doAction('risa');
        }
        return doAction('cosquillas');
      }
      return doAction('baile');
    }
    if (g.kind === 'hold') return doAction('abrazo');
    if (g.kind === 'rock') return doAction(night ? 'dormida' : 'mareo');
    if (g.kind === 'rub') return doAction('rascar');
    const zone = zoneAt(g.x, g.y, base.expression, action);
    if (!zone) return;
    if (showBlanket) {
      // Arropada: al tocarla se despierta un poquito
      setArropada(false);
    }
    if (zone === 'panza') {
      // Muchas cosquillas seguidas → ataque de risa
      const now = Date.now();
      tickles.current = [...tickles.current.filter((t) => now - t < TICKLE_WINDOW_MS), now];
      if (tickles.current.length >= 3) {
        tickles.current = [];
        return doAction('risa');
      }
    }
    doAction(
      zone === 'cabeza'
        ? 'mimo'
        : zone === 'cachetes'
          ? 'cachetes'
          : zone === 'panza'
          ? 'cosquillas'
          : zone === 'mano-izq'
            ? 'choca-izq'
            : zone === 'mano-der'
              ? 'choca-der'
              : zone === 'cinta'
                ? 'cinta'
                : 'saludo',
    );
  };

  const gestures = useCacheteGestures(onGesture);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (pendingNote) void deliverNote();
      else doAction('saludo');
    }
  };

  const pickMood = async (m: Mood) => {
    setMoodOpen(false);
    setError(null);
    const r = moodReply(m, profile.displayName, Date.now());
    setOverride({ expression: r.expression, phrase: r.phrase, until: Date.now() + 9000 });
    setOfferBreath(r.offerBreath);
    play(m === 'contenta' ? 'mimo' : 'abrazo');
    try {
      await saveDay(today, { mood: m });
    } catch (err) {
      setError(errorText(err));
    }
  };

  const activeOverride = override && override.until > now.getTime() ? override : null;
  const fromName = pendingNote?.fromName ?? '';
  const phrase = activeOverride
    ? activeOverride.phrase
    : baseIsEvent || action
      ? base.phrase
      : pendingNote
        ? `Tengo algo para vos de parte de ${fromName} 💌 Tocame`
        : special
          ? specialPhrase(special, profile.displayName)
          : showBlanket
            ? `Shhh… estoy arropadita. Que descanses, ${profile.displayName} 🌙`
            : base.phrase;
  const expression: Expression = activeOverride ? activeOverride.expression : showBlanket ? 'descanso' : pendingNote && !baseIsEvent ? 'sorpresa' : base.expression;

  const unlockedCount = profile.look.unlocked.filter((k) => ACCESSORIES.some((a) => a.key === k)).length;

  return (
    <>
      <div className="den-stage">
        <AnimatePresence mode="wait">
          <motion.p
            key={phrase}
            className="bubble"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            aria-live="polite"
          >
            {phrase}
          </motion.p>
        </AnimatePresence>
        <div
          ref={gestures.ref}
          className="cachete-touch"
          role="button"
          tabIndex={0}
          aria-label={pendingNote ? `${profile.mascotName} tiene una notita para vos. Tocala para abrirla.` : `${profile.mascotName}. Tocala, abrazala o mecela.`}
          onKeyDown={onKey}
          {...gestures.handlers}
          onPointerDown={(e) => {
            lastTouch.current = Date.now();
            shake.resumeOnTouch();
            gestures.handlers.onPointerDown(e);
          }}
        >
          <Cachete
            expression={expression}
            size={216}
            action={action}
            look={look}
            lookAt={gestures.lookAt}
            envelope={!!pendingNote}
            blanket={showBlanket}
            confetti={confetti}
          />
        </div>
        <button type="button" className="den-help" aria-label={`¿Qué le puedo hacer a ${profile.mascotName}?`} onClick={() => setHelpOpen(true)}>
          ?
        </button>
      </div>

      <div className="den-tools">
        <button
          type="button"
          className={`den-tool${newLook ? ' has-new' : ''}`}
          onClick={() => {
            setLookOpen(true);
            setNewLook(false);
            lsSet('cn_look_new', '0');
          }}
        >
          <span aria-hidden="true">👗</span> Vestir{unlockedCount ? ` (${unlockedCount})` : ''}
        </button>
        <button type="button" className="den-tool" onClick={() => setMoodOpen(true)}>
          <span aria-hidden="true">💬</span> ¿Cómo estás?
        </button>
        <button type="button" className="den-tool" onClick={() => setBreathOpen(true)}>
          <span aria-hidden="true">{night ? '🌙' : '🫧'}</span> {night ? 'Buenas noches' : 'Respirar'}
        </button>
      </div>

      {offerBreath && activeOverride && (
        <div className="den-offer">
          <button
            type="button"
            className="btn-primary btn-small"
            onClick={() => {
              setOfferBreath(false);
              setBreathOpen(true);
            }}
          >
            Respirar un minuto con {profile.mascotName}
          </button>
        </div>
      )}
      {error && <p className="form-error den-error">{error}</p>}

      <LookSheet open={lookOpen} onClose={() => setLookOpen(false)} />
      <GesturesSheet
        open={helpOpen}
        name={profile.mascotName}
        shake={shake.status}
        onEnableShake={() => {
          void shake.enable().then((ok) => {
            if (ok) doAction('sacudida');
          });
        }}
        onClose={() => setHelpOpen(false)}
      />
      <MoodSheet open={moodOpen} current={day.mood} onPick={(m) => void pickMood(m)} onClose={() => setMoodOpen(false)} />
      <BreathSheet
        open={breathOpen}
        night={night}
        name={profile.displayName}
        onDone={() => {
          if (night) {
            setArropada(true);
            lsSet(`cn_arropada_${today}`, '1');
            emit('arropada');
          }
        }}
        onClose={() => setBreathOpen(false)}
      />
      <NoteModal
        note={note}
        onClose={() => {
          setNote(null);
          emit('notita-abierta');
          doAction('abrazo');
        }}
      />
    </>
  );
}
