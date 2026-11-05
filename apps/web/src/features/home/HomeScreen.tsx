import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dayFeedback, emptyDay, formatRange, mascotState, plannedFor, summarizeDay, tipsFor, weekdayIndex, WEEKDAYS, type Meal } from '@nutrimapache/shared';
import { errorText } from '../../lib/api';
import { play } from '../../lib/sound';
import { localDate, useStore } from '../../lib/store';
import { useOpenMealSheet } from '../meals/registerContext';
import { DaySheet } from '../day/DaySheet';
import { InspirationSheet } from '../inspiration/InspirationSheet';
import { CacheteStage } from '../cachete/CacheteStage';

const EVENT_TTL = 6000;
/** Hasta cuántos días para atrás se puede ir a completar (los días anotados se cargan de los últimos 120). */
const MAX_BACK = 60;
const DAY_MS = 864e5;
const atNoon = (date: string) => new Date(`${date}T12:00:00`);

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
  // Día que se está mirando: hoy, o uno anterior elegido con las flechitas (?dia=YYYY-MM-DD).
  const [params, setParams] = useSearchParams();
  const minDate = localDate(new Date(now.getTime() - MAX_BACK * DAY_MS));
  const picked = params.get('dia');
  const viewing = picked && /^\d{4}-\d{2}-\d{2}$/.test(picked) && picked < today && picked >= minDate ? picked : today;
  const isToday = viewing === today;
  const viewDate = isToday ? now : atNoon(viewing);
  const goTo = (date: string) => setParams(date >= today ? {} : { dia: date }, { replace: true });
  const shiftDay = (delta: number) => goTo(localDate(new Date(atNoon(viewing).getTime() + delta * DAY_MS)));

  const todaysMeals = meals.filter((m) => m.date === viewing);
  const dayIdx = weekdayIndex(viewDate);
  const planned = plannedFor(profile, viewDate);
  const training = plannedFor(profile, now);
  const realDay = useStore((s) => s.days[today]) ?? emptyDay(today);
  const day = useStore((s) => s.days[viewing]) ?? emptyDay(viewing);
  const daySummary = summarizeDay(day, planned);
  const tomorrow = plannedFor(profile, new Date(now.getTime() + 864e5));
  const [dismissed, dismiss] = useDismissedTips(today);
  const tip = tipsFor({
    hour: now.getHours(),
    profile,
    today: realDay,
    loggedSlots: [...new Set(meals.filter((m) => m.date === today).map((m) => m.slotKey))],
    plannedToday: !!training,
    trainsTomorrowMorning: !!tomorrow?.sessions.some((x) => x.moment === 'mañana'),
  }).find((t) => !dismissed.includes(t.id));

  /** El botón de la sugerencia siempre suma a hoy, aunque se esté mirando otro día. */
  const addWater = async (delta: number, date = viewing) => {
    setDayError(null);
    try {
      const current = date === today ? realDay : day;
      const water = Math.max(0, Math.min(30, current.water + delta));
      if (water === current.water) return;
      const p = saveDay(date, { water });
      if (delta > 0) {
        emit('agua-registrada');
        play('agua');
      }
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
          isRestDay: !training || realDay.status === 'descanso',
          name: profile.mascotName,
          displayName: profile.displayName,
          daysSinceLastLog,
        },
        active?.at ?? 0,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active?.at, active?.event, now.getHours(), training?.key, realDay.status, profile.displayName, profile.mascotName, daysSinceLastLog],
  );

  const bySlot = (key: string) => todaysMeals.filter((m) => m.slotKey === key);
  const extras = todaysMeals.filter((m) => !profile.mealSlots.some((s) => s.key === m.slotKey));

  return (
    <div className="home">
      <section className="den" aria-label={`${profile.mascotName}, tu compañera`}>
        <div className="den-top">
          <div className="den-nav">
            <button type="button" className="den-arrow" aria-label="Día anterior" disabled={viewing <= minDate} onClick={() => shiftDay(-1)}>
              ‹
            </button>
            <p className="den-date">
              {WEEKDAYS[dayIdx]} {viewDate.getDate()}
            </p>
            {!isToday && (
              <button type="button" className="den-arrow" aria-label="Día siguiente" onClick={() => shiftDay(1)}>
                ›
              </button>
            )}
          </div>
          <button type="button" className={`chip chip-dusk chip-btn-dusk${daySummary ? ' is-logged' : ''}`} onClick={() => setDayOpen(true)}>
            {daySummary ??
              (planned ? `${planned.label}${planned.moment ? ` · ${planned.moment}` : ''}` : 'Día libre')}
            <span className="chip-edit" aria-hidden="true">
              {daySummary ? '✎' : '+'}
            </span>
          </button>
        </div>

        <CacheteStage base={mood} baseIsEvent={!!active} today={today} day={realDay} now={now} />
      </section>

      {!isToday && (
        <div className="past-banner" role="status">
          <p>
            Estás completando el{' '}
            {viewDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}.
          </p>
          <button type="button" className="btn-quiet btn-small" onClick={() => goTo(today)}>
            Volver a hoy
          </button>
        </div>
      )}

      <section className="day" aria-labelledby="day-title">
        {isToday && tip && (
          <aside className="tip" aria-label={`Sugerencia de ${profile.mascotName}`}>
            <p>{tip.text}</p>
            <div className="tip-actions">
              {tip.action?.kind === 'agua' && (
                <button type="button" className="btn-primary btn-small" onClick={() => void addWater(1, today)}>
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
          {isToday ? 'Tu día' : 'Ese día'}
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
                      <button type="button" className="path-empty" onClick={() => openSheet({ mode: 'new', slotKey: slot.key, date: isToday ? undefined : viewing })}>
                        Anotar cuando quieras
                      </button>
                      {aiEnabled && isToday && (
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

        {isToday && hourIsLate(now) && (
          <button type="button" className="btn-quiet btn-small yesterday-link" onClick={() => shiftDay(-1)}>
            ¿Te faltó anotar algo de ayer?
          </button>
        )}

        {/* El resumen habla de "hoy": en días anteriores no se muestra */}
        {isToday && todaysMeals.length > 0 && <DayGlance items={todaysMeals.flatMap((m) => m.items)} hour={now.getHours()} />}

        <div className="water" aria-label={isToday ? 'Agua de hoy' : 'Agua de ese día'}>
          <div>
            <h3>Agua</h3>
            <p className="hint">{day.water === 0
                ? isToday
                  ? 'Tocá + cada vez que tomes un vaso.'
                  : 'Sumá los vasos que tomaste ese día.'
                : `${day.water} ${day.water === 1 ? 'vaso' : 'vasos'} ${isToday ? 'hoy' : 'ese día'}`}</p>
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

      <DaySheet open={dayOpen} date={viewing} planned={planned} onClose={() => setDayOpen(false)} />
      <InspirationSheet slotKey={ideasFor} onClose={() => setIdeasFor(null)} />
    </div>
  );
}

/** Pasada la medianoche es fácil olvidarse de la cena: hasta las 5 se ofrece completar ayer. */
const hourIsLate = (d: Date) => d.getHours() < 5;

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

/** Resumen suave del día: una frase y una barrita contra el rango diario (cifras solo si las quiere ver). */
function DayGlance({ items, hour }: { items: Meal['items']; hour: number }) {
  const profile = useStore((s) => s.profile)!;
  const fb = dayFeedback(profile, items, hour);
  if (!fb) return null;
  const show = profile.view.showCalories;
  const pct = Math.min(100, Math.round(fb.progress * 100 * (1 / 1.3)));
  const bandFrom = (fb.energy.kcal.min / ((fb.energy.kcal.min + fb.energy.kcal.max) / 2)) * (100 / 1.3);
  const bandTo = (fb.energy.kcal.max / ((fb.energy.kcal.min + fb.energy.kcal.max) / 2)) * (100 / 1.3);
  return (
    <aside className="glance" aria-label="Cómo viene el día">
      <p>{fb.line}</p>
      {fb.kcal && (
        <>
          <div className="meter-track" aria-hidden="true">
            <span className="meter-band" style={{ left: `${bandFrom}%`, width: `${bandTo - bandFrom}%` }} />
            <span className="meter-fill" style={{ width: `${pct}%` }} />
          </div>
          {show && (
            <p className="hint">
              Llevás {formatRange(fb.kcal)} kcal de {formatRange(fb.energy.kcal)} sugeridas
              {fb.protein ? ` · proteína ${formatRange(fb.protein)} de ${formatRange(fb.energy.protein)} g` : ''}
            </p>
          )}
        </>
      )}
    </aside>
  );
}
