import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ACTIVITY_KINDS, emptyDay, formatMinutes, type Activity, type DayStatus } from '@nutrimapache/shared';
import { errorText } from '../../lib/api';
import { useStore } from '../../lib/store';

interface Props {
  open: boolean;
  date: string;
  planned: { key: string; label: string; moment: string | null } | null;
  onClose: () => void;
}

const QUICK_MINUTES = [15, 30, 45, 60, 90];

/** Cómo fue el movimiento del día: como la rutina, otra cosa o descanso. Todo opcional. */
export function DaySheet({ open, date, planned, onClose }: Props) {
  const profile = useStore((s) => s.profile)!;
  const saved = useStore((s) => s.days[date]);
  const saveDay = useStore((s) => s.saveDay);
  const emit = useStore((s) => s.emit);

  const [status, setStatus] = useState<DayStatus | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [energy, setEnergy] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState<{ kind: string; label: string; minutes?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const d = saved ?? emptyDay(date);
    setStatus(d.status);
    setActivities(d.activities);
    setEnergy(d.energy);
    setNote(d.note);
    setDraft(null);
    setBusy(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);

  // Las actividades de la propia rutina primero, después las comunes (sin repetir).
  const kinds = [
    ...profile.trainingTypes.map((t) => ({ key: t.key, label: t.label, emoji: '⭐' })),
    ...ACTIVITY_KINDS.filter((k) => !profile.trainingTypes.some((t) => t.key === k.key)),
  ];

  const addDraft = () => {
    if (!draft) return;
    setActivities([...activities, { kind: draft.kind, label: draft.label, minutes: draft.minutes }]);
    setDraft(null);
  };

  const pendingDraft = status === 'distinto' && draft !== null;
  const canSave = status !== 'distinto' || activities.length > 0 || pendingDraft;

  const save = async () => {
    const acts = status === 'distinto' ? [...activities, ...(draft ? [{ kind: draft.kind, label: draft.label, minutes: draft.minutes }] : [])] : [];
    setBusy(true);
    setError(null);
    try {
      await saveDay(date, { status, activities: acts, energy, note: note.trim() });
      if (energy !== null && energy <= 2) emit('energia-baja');
      else if (status === 'descanso') emit('descanso-elegido');
      else if (status) emit('entreno-registrado');
      onClose();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  const choice = (value: DayStatus, title: string, text: string) => (
    <button type="button" className={`choice${status === value ? ' is-on' : ''}`} aria-pressed={status === value} onClick={() => setStatus(status === value ? null : value)}>
      <strong>{title}</strong>
      <span>{text}</span>
    </button>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-sheet-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
          >
            <div className="sheet-grip" aria-hidden="true" />
            <header className="sheet-head">
              <h2 id="day-sheet-title">¿Cómo te moviste hoy?</h2>
              <button type="button" className="link" onClick={onClose}>
                Cerrar
              </button>
            </header>

            <div className="sheet-body">
              <p className="hint day-planned">
                {planned ? `Según tu rutina tocaba ${planned.label}${planned.moment ? ` a la ${planned.moment}` : ''}.` : 'Según tu rutina, hoy era día libre.'} Lo que
                hagas está bien: acá solo lo anotamos.
              </p>

              <div className="choices">
                {planned && choice('como-plan', 'Lo hice como estaba', planned.label)}
                {choice('distinto', planned ? 'Hice otra cosa' : 'Me moví igual', 'Caminata, bici, yoga, lo que sea')}
                {choice('descanso', 'Hoy descanso', 'Recuperar también es parte')}
              </div>

              {status === 'distinto' && (
                <div className="field">
                  <span>¿Qué hiciste?</span>
                  {activities.length > 0 && (
                    <ul className="act-list">
                      {activities.map((a, i) => (
                        <li key={i}>
                          <span>
                            {a.label}
                            {a.minutes ? ` · ${formatMinutes(a.minutes)}` : ''}
                          </span>
                          <button type="button" className="icon-btn" aria-label={`Quitar ${a.label}`} onClick={() => setActivities(activities.filter((_, j) => j !== i))}>
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="chips">
                    {kinds.map((k) => (
                      <button
                        key={k.key}
                        type="button"
                        className={`chip-btn${draft?.kind === k.key ? ' is-on' : ''}`}
                        aria-pressed={draft?.kind === k.key}
                        onClick={() => setDraft(draft?.kind === k.key ? null : { kind: k.key, label: k.label, minutes: draft?.minutes })}
                      >
                        <span aria-hidden="true">{k.emoji} </span>
                        {k.label}
                      </button>
                    ))}
                  </div>

                  {draft && (
                    <div className="act-draft">
                      <span className="hint">¿Cuánto tiempo? (opcional)</span>
                      <div className="chips">
                        {QUICK_MINUTES.map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={`chip-btn${draft.minutes === m ? ' is-on' : ''}`}
                            aria-pressed={draft.minutes === m}
                            onClick={() => setDraft({ ...draft, minutes: draft.minutes === m ? undefined : m })}
                          >
                            {formatMinutes(m)}
                          </button>
                        ))}
                        <input
                          className="act-min"
                          inputMode="numeric"
                          aria-label="Otros minutos"
                          placeholder="min"
                          value={draft.minutes && !QUICK_MINUTES.includes(draft.minutes) ? String(draft.minutes) : ''}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            setDraft({ ...draft, minutes: Number.isFinite(v) && v > 0 && v <= 600 ? v : undefined });
                          }}
                        />
                      </div>
                      <button type="button" className="link" onClick={addDraft}>
                        Sumar otra actividad
                      </button>
                    </div>
                  )}
                </div>
              )}

              <fieldset className="field">
                <legend>¿Cómo está tu energía? (opcional)</legend>
                <div className="scale" role="radiogroup">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={energy === n}
                      className={`scale-btn${energy === n ? ' is-on' : ''}`}
                      onClick={() => setEnergy(energy === n ? null : n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="hint">1 = con poca energía · 5 = a pleno</p>
              </fieldset>

              <label className="field">
                <span>Nota (opcional)</span>
                <textarea rows={2} maxLength={280} placeholder="Ej.: fui caminando al trabajo" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>

            {error && (
              <p className="form-error sheet-error" role="alert">
                {error}
              </p>
            )}
            <footer className="sheet-foot">
              <button type="button" className="btn-primary" disabled={!canSave || busy} onClick={() => void save()}>
                {busy ? 'Guardando…' : 'Guardar'}
              </button>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
