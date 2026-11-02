import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ACCESSORIES,
  moodReply,
  newUnlocks,
  specialPhrase,
  usageStats,
  type DayLog,
  type Expression,
  type MascotEvent,
  type Mood,
  type Note,
} from '@nutrimapache/shared';
import { Cachete, zoneAt, type CacheteAction, type CacheteLook } from '../../mascot/Cachete';
import { useCacheteGestures, type Gesture } from '../../mascot/useCacheteGestures';
import { errorText } from '../../lib/api';
import { play, type SoundKind } from '../../lib/sound';
import { useStore } from '../../lib/store';
import { BreathSheet } from './BreathSheet';
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

const ACTION_MS: Partial<Record<CacheteAction, number>> = { dormida: 9000, baile: 3200, abrazo: 2800, mareo: 3200 };

const ACTION_EVENT: Record<CacheteAction, MascotEvent> = {
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
};

const ACTION_SOUND: Record<CacheteAction, SoundKind> = {
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

  const doAction = (a: CacheteAction) => {
    clearTimeout(actionTimer.current);
    setAction(a);
    setOverride(null);
    emit(ACTION_EVENT[a]);
    play(ACTION_SOUND[a]);
    actionTimer.current = setTimeout(() => setAction(null), ACTION_MS[a] ?? 2600);
  };

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
    if (g.kind === 'double') return doAction('baile');
    if (g.kind === 'hold') return doAction('abrazo');
    if (g.kind === 'rock') return doAction(night ? 'dormida' : 'mareo');
    const zone = zoneAt(g.x, g.y, base.expression, action);
    if (!zone) return;
    if (showBlanket) {
      // Arropada: al tocarla se despierta un poquito
      setArropada(false);
    }
    doAction(
      zone === 'cabeza'
        ? 'mimo'
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
        >
          <Cachete
            expression={expression}
            size={176}
            action={action}
            look={look}
            lookAt={gestures.lookAt}
            envelope={!!pendingNote}
            blanket={showBlanket}
            confetti={confetti}
          />
        </div>
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
