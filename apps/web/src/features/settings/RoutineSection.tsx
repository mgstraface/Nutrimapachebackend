import { useEffect, useRef, useState } from 'react';
import { GOAL_LABELS, WEEKDAYS, type Goal, type Moment, type MealSlot, type Profile, type Routine, type TrainingType } from '@nutrimapache/shared';

const MOMENTS = ['mañana', 'mediodía', 'tarde', 'noche'] as const;

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 18) || 'actividad';

/**
 * "Tu semana": objetivo, tipos de actividad, qué hace cada día y sus comidas.
 * Cambia lo habitual; lo de un día puntual se anota desde Hoy.
 */
export function RoutineSection({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => Promise<void> }) {
  const [goal, setGoal] = useState<Goal>(profile.goal);
  const [types, setTypes] = useState<TrainingType[]>(profile.trainingTypes);
  const [routine, setRoutine] = useState<Routine>(profile.routine);
  const [slots, setSlots] = useState<MealSlot[]>(profile.mealSlots);
  const [newType, setNewType] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const ref = useRef<HTMLElement>(null);
  // Si se llega desde "Cambiar mi rutina habitual", baja directo a esta sección.
  useEffect(() => {
    if (location.hash === '#semana') ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const touch = () => setSaved(false);
  const draft: Profile = { ...profile, goal, trainingTypes: types, routine, mealSlots: slots };
  const changed = JSON.stringify([goal, types, routine, slots]) !== JSON.stringify([profile.goal, profile.trainingTypes, profile.routine, profile.mealSlots]);
  const slotsOk = slots.length >= 2 && slots.every((s) => s.label.trim() && /^\d{2}:\d{2}$/.test(s.time));

  const addType = () => {
    const label = newType.trim().slice(0, 30);
    if (!label || types.length >= 10) return;
    let key = slug(label);
    while (types.some((t) => t.key === key)) key = `${key.slice(0, 20)}-${Math.random().toString(36).slice(2, 4)}`;
    setTypes([...types, { key, label }]);
    setNewType('');
    touch();
  };

  const removeType = (key: string) => {
    setTypes(types.filter((t) => t.key !== key));
    // Los días que tenían esa actividad pasan a libres
    setRoutine(
      routine.map((d) => {
        const more = (d.more ?? []).filter((m) => m.trainingKey !== key);
        if (d.trainingKey !== key) return { ...d, more };
        // Si se borra la principal, la primera de las otras pasa a ser la principal
        const [first, ...rest] = more;
        return first ? { trainingKey: first.trainingKey, moment: first.moment, more: rest } : { trainingKey: null, moment: null, more: [] };
      }),
    );
    touch();
  };

  const setDay = (i: number, patch: Partial<Routine[number]>) => {
    setRoutine(
      routine.map((d, j) => {
        if (j !== i) return d;
        const next = { ...d, ...patch };
        if (!next.trainingKey) return { trainingKey: null, moment: null, more: [] };
        return { ...next, moment: next.moment ?? 'mañana', more: next.more ?? [] };
      }),
    );
    touch();
  };

  const setMore = (i: number, k: number, patch: Partial<Routine[number]['more'][number]>) => {
    setRoutine(routine.map((d, j) => (j === i ? { ...d, more: (d.more ?? []).map((m, x) => (x === k ? { ...m, ...patch } : m)) } : d)));
    touch();
  };

  const addMore = (i: number) => {
    setRoutine(
      routine.map((d, j) => {
        if (j !== i) return d;
        // Sugiere otra actividad distinta y un momento más tarde que la anterior
        const used = [d.trainingKey, ...(d.more ?? []).map((m) => m.trainingKey)];
        const key = types.find((t) => !used.includes(t.key))?.key ?? types[0]!.key;
        const last = (d.more ?? []).at(-1)?.moment ?? d.moment ?? 'mañana';
        const moment: Moment = last === 'mañana' || last === 'mediodía' ? 'tarde' : 'noche';
        return { ...d, more: [...(d.more ?? []), { trainingKey: key, moment }] };
      }),
    );
    touch();
  };

  const removeMore = (i: number, k: number) => {
    setRoutine(routine.map((d, j) => (j === i ? { ...d, more: (d.more ?? []).filter((_, x) => x !== k) } : d)));
    touch();
  };

  const setSlot = (i: number, patch: Partial<MealSlot>) => {
    setSlots(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    touch();
  };

  return (
    <section ref={ref} className="group routine" id="semana">
      <h2>Tu semana</h2>

      <label className="field">
        <span>¿Qué buscás?</span>
        <select
          value={goal}
          onChange={(e) => {
            setGoal(e.target.value as Goal);
            touch();
          }}
        >
          {Object.entries(GOAL_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span>Tus actividades</span>
        <ul className="pantry" aria-label="Tipos de actividad">
          {types.map((t) => (
            <li key={t.key} className="pantry-chip">
              {t.label}
              <button type="button" aria-label={`Quitar ${t.label}`} onClick={() => removeType(t.key)}>
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="pantry-add">
          <input
            value={newType}
            maxLength={30}
            placeholder="Ej: Pilates, Caminata, Fútbol"
            aria-label="Nueva actividad"
            onChange={(e) => setNewType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addType();
              }
            }}
          />
          <button type="button" className="btn-quiet btn-small" disabled={!newType.trim() || types.length >= 10} onClick={addType}>
            Sumar
          </button>
        </div>
      </div>

      <div className="field">
        <span>Qué hacés cada día</span>
        <div className="week-rows">
          {routine.map((d, i) => (
            <div key={i} className={`week-day${d.trainingKey ? ' is-on' : ''}`}>
              <div className="week-row">
                <strong>{WEEKDAYS[i]}</strong>
                <select aria-label={`Actividad del ${WEEKDAYS[i]}`} value={d.trainingKey ?? ''} onChange={(e) => setDay(i, { trainingKey: e.target.value || null })}>
                  <option value="">Libre</option>
                  {types.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Momento del ${WEEKDAYS[i]}`}
                  value={d.moment ?? ''}
                  disabled={!d.trainingKey}
                  onChange={(e) => setDay(i, { moment: e.target.value as Moment })}
                >
                  {!d.trainingKey && <option value="">—</option>}
                  {MOMENTS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <span />
              </div>
              {d.trainingKey &&
                (d.more ?? []).map((m, k) => (
                  <div key={k} className="week-row is-more">
                    <span aria-hidden="true">y</span>
                    <select aria-label={`Otra actividad del ${WEEKDAYS[i]}`} value={m.trainingKey} onChange={(e) => setMore(i, k, { trainingKey: e.target.value })}>
                      {types.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <select aria-label={`Momento de la otra actividad del ${WEEKDAYS[i]}`} value={m.moment} onChange={(e) => setMore(i, k, { moment: e.target.value as Moment })}>
                      {MOMENTS.map((mm) => (
                        <option key={mm} value={mm}>
                          {mm}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="icon-btn" aria-label="Quitar esta actividad" onClick={() => removeMore(i, k)}>
                      ×
                    </button>
                  </div>
                ))}
              {d.trainingKey && (d.more ?? []).length < 3 && types.length > 0 && (
                <button type="button" className="link week-add" onClick={() => addMore(i)}>
                  + Otra actividad este día
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="hint">Esto también ajusta tu sugerencia de energía diaria. Si un día hacés algo distinto, anotalo desde Hoy.</p>
      </div>

      <div className="field">
        <span>Tus comidas del día</span>
        <div className="slots">
          {slots.map((s, i) => (
            <div key={s.key} className="slot-row">
              <input aria-label="Nombre de la comida" value={s.label} maxLength={30} onChange={(e) => setSlot(i, { label: e.target.value })} />
              <input aria-label="Hora aproximada" type="time" value={s.time} onChange={(e) => setSlot(i, { time: e.target.value })} />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Quitar ${s.label}`}
                disabled={slots.length <= 2}
                onClick={() => {
                  setSlots(slots.filter((_, j) => j !== i));
                  touch();
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {slots.length < 6 && (
          <button
            type="button"
            className="link"
            onClick={() => {
              setSlots([...slots, { key: `comida-${Date.now().toString(36)}`, label: 'Colación', time: '11:00' }]);
              touch();
            }}
          >
            Sumar una comida
          </button>
        )}
        <p className="hint">Lo que ya anotaste queda igual. Si sacás una comida, lo anotado ahí se sigue viendo en Historial.</p>
      </div>

      <button
        type="button"
        className="btn-primary"
        disabled={!changed || !slotsOk || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const sorted = [...slots].sort((a, b) => a.time.localeCompare(b.time));
            setSlots(sorted);
            await onSave({ ...draft, mealSlots: sorted });
            setSaved(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Guardando…' : saved && !changed ? 'Guardado' : 'Guardar mi semana'}
      </button>
    </section>
  );
}
