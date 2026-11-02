import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { emptyDay, mascotState, plannedFor, summarizeDay, tipsFor, weekdayIndex, WEEKDAYS, type Meal } from '@nutrimapache/shared';
import { Cachete } from '../../mascot/Cachete';
import { errorText } from '../../lib/api';
import { localDate, useStore } from '../../lib/store';
import { useOpenMealSheet } from '../meals/registerContext';
import { DaySheet } from '../day/DaySheet';
import { InspirationSheet } from '../inspiration/InspirationSheet';

const EVENT_TTL = 6000;

export function HomeScreen() {
  const profile = useStore((s) => s.profile)!;
  const meals = useStore((s) => s.meals);
  const lastEvent = useStore((s) => s.lastEvent);
  const emit = useStore((s) => s.emit);
  const saveDay = useStore((s) => s.saveDay);
  const openSheet = useOpenMealSheet();
  const [now, setNow] = useState(() => new Date());
  const [dayOpen, setDayOpen] = useState(false);
  const [ideasFor, setIdeasFor] = useState<string | null>(null);
  const aiEnabled = useStore((s) => !!s.ai?.enabled);
  const [dayError, setDayError] = useState<string | null>(null);

  // Re-evaluar el ánimo de Cachete cuando vence un evento.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 2000);
    return () => clearInterval(t);
  }, []);

  const today = localDate(now);
  const todaysMeals = meals.filter((m) => m.date === today);
  const dayIdx = weekdayIndex(now);
  const planned = plannedFor(profile, now);
  const training = planned;
  const day = useStore((s) => s.days[today]) ?? emptyDay(today);
  const daySummary = summarizeDay(day, planned);
  const tomorrow = plannedFor(profile, new Date(now.getTime() + 864e5));
  const [dismissed, dismiss] = useDismissedTips(today);
  const tip = tipsFor({
    hour: now.getHours(),
    profile,
    today: day,
    loggedSlots: [...new Set(meals.filter((m) => m.date === today).map((m) => m.slotKey))],
    plannedToday: !!planned,
    trainsTomorrowMorning: tomorrow?.moment === 'mañana',
  }).find((t) => !dismissed.includes(t.id));

  const addWater = async (delta: number) => {
    setDayError(null);
    try {
      const water = Math.max(0, Math.min(30, day.water + delta));
      if (water === day.water) return;
      const p = saveDay(today, { water });
      if (delta > 0) emit('agua-registrada');
      await p;
    } catch (err) {
      setDayError(errorText(err));
    }
  };

  const lastLogAt = meals.reduce((max, m) => Math.max(max, Date.parse(m.createdAt)), 0);
  const daysSinceLastLog = lastLogAt ? Math.floor((now.getTime() - lastLogAt) / 864e5) : 0;

  const active = lastEvent && now.getTime() - lastEvent.at < EVENT_TTL ? lastEvent : null;
  const mood = useMemo(
    () =>
      mascotState(
        {
          event: active?.event ?? 'abrir-app',
          hour: now.getHours(),
          isRestDay: !training || day.status === 'descanso',
          name: profile.mascotName,
          displayName: profile.displayName,
          daysSinceLastLog,
        },
        active?.at ?? 0,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active?.at, active?.event, now.getHours(), training?.key, day.status, profile.displayName, profile.mascotName, daysSinceLastLog],
  );

  const bySlot = (key: string) => todaysMeals.filter((m) => m.slotKey === key);
  const extras = todaysMeals.filter((m) => !profile.mealSlots.some((s) => s.key === m.slotKey));

  return (
    <div className="home">
      <section className="den" aria-label={`${profile.mascotName}, tu compañera`}>
        <div className="den-top">
          <p className="den-date">
            {WEEKDAYS[dayIdx]} {now.getDate()}
          </p>
          <button type="button" className={`chip chip-dusk chip-btn-dusk${daySummary ? ' is-logged' : ''}`} onClick={() => setDayOpen(true)}>
            {daySummary ??
              (training ? `${training.label}${training.moment ? ` · ${training.moment}` : ''}` : 'Día libre')}
            <span className="chip-edit" aria-hidden="true">
              {daySummary ? '✎' : '+'}
            </span>
          </button>
        </div>

        <div className="den-stage">
          <AnimatePresence mode="wait">
            <motion.p
              key={mood.phrase}
              className="bubble"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22 }}
              aria-live="polite"
            >
              {mood.phrase}
            </motion.p>
          </AnimatePresence>
          <Cachete expression={mood.expression} size={176} label={profile.mascotName} onPet={() => emit('caricia')} />
        </div>
      </section>

      <section className="day" aria-labelledby="day-title">
        {tip && (
          <aside className="tip" aria-label={`Sugerencia de ${profile.mascotName}`}>
            <p>{tip.text}</p>
            <div className="tip-actions">
              {tip.action?.kind === 'agua' && (
                <button type="button" className="btn-primary btn-small" onClick={() => void addWater(1)}>
                  {tip.action.label}
                </button>
              )}
              <button type="button" className="btn-quiet btn-small" onClick={() => dismiss(tip.id)}>
                Ahora no
              </button>
            </div>
          </aside>
        )}

        <h2 id="day-title" className="day-title">
          Tu día
        </h2>
        <ol className="path">
          {profile.mealSlots.map((slot) => {
            const list = bySlot(slot.key);
            return (
              <li key={slot.key} className={`path-step${list.length ? ' is-logged' : ''}`}>
                <span className="path-dot" aria-hidden="true" />
                <div className="path-body">
                  <div className="path-head">
                    <h3>
                      {slot.emoji ? <span aria-hidden="true">{slot.emoji} </span> : null}
                      {slot.label}
                    </h3>
                    <span className="path-time">{slot.time}</span>
                  </div>
                  {list.length ? (
                    list.map((m) => <MealLine key={m.id} meal={m} onOpen={() => openSheet({ mode: 'edit', mealId: m.id })} />)
                  ) : (
                    <div className="path-actions">
                      <button type="button" className="path-empty" onClick={() => openSheet({ mode: 'new', slotKey: slot.key })}>
                        Anotar cuando quieras
                      </button>
                      {aiEnabled && (
                        <button type="button" className="ideas-btn" onClick={() => setIdeasFor(slot.key)}>
                          <span aria-hidden="true">✨</span> Ideas
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {extras.length > 0 && (
          <div className="extras">
            <h3>Otras cosas que comiste</h3>
            {extras.map((m) => (
              <MealLine key={m.id} meal={m} onOpen={() => openSheet({ mode: 'edit', mealId: m.id })} />
            ))}
          </div>
        )}

        <div className="water" aria-label="Agua de hoy">
          <div>
            <h3>Agua</h3>
            <p className="hint">{day.water === 0 ? 'Tocá + cada vez que tomes un vaso.' : day.water === 1 ? '1 vaso hoy' : `${day.water} vasos hoy`}</p>
          </div>
          <div className="water-glasses" aria-hidden="true">
            {Array.from({ length: Math.min(day.water, 10) }, (_, i) => (
              <span key={i} className="drop" />
            ))}
            {day.water > 10 && <span className="hint">+{day.water - 10}</span>}
          </div>
          <div className="water-btns">
            <button type="button" className="water-btn" aria-label="Quitar un vaso" disabled={day.water === 0} onClick={() => void addWater(-1)}>
              −
            </button>
            <button type="button" className="water-btn water-add" aria-label="Sumar un vaso" onClick={() => void addWater(1)}>
              +
            </button>
          </div>
        </div>
        {dayError && (
          <p className="form-error" role="alert">
            {dayError}
          </p>
        )}
      </section>

      <DaySheet open={dayOpen} date={today} planned={planned} onClose={() => setDayOpen(false)} />
      <InspirationSheet slotKey={ideasFor} onClose={() => setIdeasFor(null)} />
    </div>
  );
}

/** Sugerencias descartadas hoy. Se guardan solo en este dispositivo: es una comodidad, no un dato. */
function useDismissedTips(date: string): [string[], (id: string) => void] {
  const key = `cn_tips_${date}`;
  const read = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
    } catch {
      return [];
    }
  };
  const [list, setList] = useState<string[]>(read);
  useEffect(() => setList(read()), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const dismiss = (id: string) => {
    const next = [...list, id];
    setList(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* sin localStorage: queda descartada hasta recargar */
    }
  };
  return [list, dismiss];
}

function MealLine({ meal, onOpen }: { meal: Meal; onOpen: () => void }) {
  const text = meal.description || meal.items.map((i) => i.name).join(', ') || 'Sin detalle';
  return (
    <button type="button" className="meal-line" onClick={onOpen}>
      <span className="meal-line-text">{text}</span>
      {meal.time && <span className="meal-line-time">{meal.time}</span>}
    </button>
  );
}
