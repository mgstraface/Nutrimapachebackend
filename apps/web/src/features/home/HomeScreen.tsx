import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { mascotState, weekdayIndex, WEEKDAYS, type Meal } from '@nutrimapache/shared';
import { Mapache } from '../../mascot/Mapache';
import { localDate, useStore } from '../../lib/store';
import { useOpenMealSheet } from '../meals/registerContext';

const EVENT_TTL = 6000;

export function HomeScreen() {
  const profile = useStore((s) => s.profile)!;
  const meals = useStore((s) => s.meals);
  const lastEvent = useStore((s) => s.lastEvent);
  const emit = useStore((s) => s.emit);
  const openSheet = useOpenMealSheet();
  const [now, setNow] = useState(() => new Date());

  // Re-evaluar el ánimo del mapache cuando vence un evento.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 2000);
    return () => clearInterval(t);
  }, []);

  const today = localDate(now);
  const todaysMeals = meals.filter((m) => m.date === today);
  const dayIdx = weekdayIndex(now);
  const routineToday = profile.routine[dayIdx];
  const training = profile.trainingTypes.find((t) => t.key === routineToday?.trainingKey);

  const lastLogAt = meals.reduce((max, m) => Math.max(max, Date.parse(m.createdAt)), 0);
  const daysSinceLastLog = lastLogAt ? Math.floor((now.getTime() - lastLogAt) / 864e5) : 0;

  const active = lastEvent && now.getTime() - lastEvent.at < EVENT_TTL ? lastEvent : null;
  const mood = useMemo(
    () =>
      mascotState(
        {
          event: active?.event ?? 'abrir-app',
          hour: now.getHours(),
          isRestDay: !training,
          name: profile.mascotName,
          displayName: profile.displayName,
          daysSinceLastLog,
        },
        active?.at ?? 0,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active?.at, active?.event, now.getHours(), training?.key, profile.displayName, profile.mascotName, daysSinceLastLog],
  );

  const bySlot = (key: string) => todaysMeals.filter((m) => m.slotKey === key);
  const extras = todaysMeals.filter((m) => !profile.mealSlots.some((s) => s.key === m.slotKey));

  return (
    <div className="home">
      <section className="den" aria-label={`${profile.mascotName}, tu mapache`}>
        <div className="den-top">
          <p className="den-date">
            {WEEKDAYS[dayIdx]} {now.getDate()}
          </p>
          {training ? (
            <span className="chip chip-dusk">
              {training.label}
              {routineToday?.moment ? ` · ${routineToday.moment}` : ''}
            </span>
          ) : (
            <span className="chip chip-dusk">Día libre</span>
          )}
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
          <Mapache expression={mood.expression} size={190} onPet={() => emit('caricia')} />
        </div>
        <svg className="den-hill" viewBox="0 0 390 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 40 V22 C80 2 150 0 210 10 C280 22 330 10 390 4 V40 Z" fill="var(--mist)" />
        </svg>
      </section>

      <section className="day" aria-labelledby="day-title">
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
                    <button type="button" className="path-empty" onClick={() => openSheet({ mode: 'new', slotKey: slot.key })}>
                      Anotar cuando quieras
                    </button>
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
      </section>
    </div>
  );
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
