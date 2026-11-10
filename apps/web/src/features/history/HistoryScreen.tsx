import { addDays, bodyProgress, formatRange, plannedFor, summarizeDay, weekPattern, weekStart, weekSummary, type Meal, type Profile } from '@nutrimapache/shared';
import { Link } from 'react-router-dom';
import { localDate, useStore } from '../../lib/store';

export function HistoryScreen() {
  const meals = useStore((s) => s.meals);
  const days = useStore((s) => s.days);
  const profile = useStore((s) => s.profile)!;
  const label = (key: string) => profile.mealSlots.find((s) => s.key === key)?.label ?? 'Otro momento';

  const byDay = meals.reduce<Record<string, typeof meals>>((acc, m) => {
    (acc[m.date] ??= []).push(m);
    return acc;
  }, {});
  // Un día aparece si tiene comidas o algo anotado (actividad, agua, energía, nota).
  const hasLog = (d: string) => {
    const x = days[d];
    return !!x && (x.status !== null || x.water > 0 || x.energy !== null || x.note !== '');
  };
  // Hasta acá se puede ir desde el inicio a completar o corregir (mismo límite que las flechitas).
  const minDate = localDate(new Date(Date.now() - 60 * 864e5));
  const today = localDate();
  const dates = [...new Set([...Object.keys(byDay), ...Object.keys(days).filter(hasLog)])].sort().reverse();

  return (
    <div className="page">
      <h1 className="page-title">Historial</h1>
      <ProgressCard />
      <WeeksOverview profile={profile} meals={meals} today={today} />
      {dates.length === 0 ? (
        <p className="empty">Cuando anotes tu primera comida, la vas a ver acá.</p>
      ) : (
        dates.map((d) => {
          const when = new Date(`${d}T12:00:00`);
          const day = days[d];
          const move = summarizeDay(day, plannedFor(profile, when));
          const extras = [move, day && day.water > 0 ? `${day.water} ${day.water === 1 ? 'vaso' : 'vasos'} de agua` : null].filter(Boolean);
          return (
            <section key={d} className="hist-day">
              <div className="hist-head">
                <h2>{when.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
                {d >= minDate && (
                  <Link className="link hist-edit" to={d === today ? '/' : `/?dia=${d}`}>
                    Editar
                  </Link>
                )}
              </div>
              {extras.length > 0 && <p className="hist-move">{extras.join(' · ')}</p>}
              {byDay[d] && (
                <ul>
                  {byDay[d]!
                    .slice()
                    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
                    .map((m) => (
                      <li key={m.id}>
                        <span className="hist-slot">{label(m.slotKey)}</span>
                        <span>{m.description || m.items.map((i) => i.name).join(', ')}</span>
                      </li>
                    ))}
                </ul>
              )}
              {day?.note && <p className="hint">“{day.note}”</p>}
            </section>
          );
        })
      )}
    </div>
  );
}

const WEEK_STATE = { margen: 'con margen', 'en-linea': 'pareja', arriba: 'un poco por encima', arranca: 'recién arranca' } as const;

/** Las últimas semanas en total y cómo se come entre semana vs. el finde. */
function WeeksOverview({ profile, meals, today }: { profile: Profile; meals: Meal[]; today: string }) {
  const show = profile.view.showCalories;
  const current = weekStart(today);
  const weeks = [0, 1, 2, 3]
    .map((back) => {
      const start = addDays(current, -7 * back);
      // Semanas pasadas: se miran desde hoy, así sus 7 días cuentan como terminados.
      const w = weekSummary(profile, meals, today, show, start);
      return w && w.loggedDays + (back === 0 && w.days.some((d) => d.kind === 'hoy' && d.kcal) ? 1 : 0) >= 2 ? { start, back, w } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const pattern = weekPattern(profile, meals, today);
  if (!weeks.length && !pattern?.line) return null;

  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  return (
    <section className="hist-weeks glance" aria-label="Tus semanas">
      <p className="week-title">Tus semanas</p>
      {weeks.length > 0 && (
        <ul>
          {weeks.map(({ start, back, w }) => (
            <li key={start}>
              <span>
                {back === 0 ? 'Esta semana' : `${fmt(start)} – ${fmt(addDays(start, 6))}`}
                {show && <span className="hint"> · {formatRange(w.soFar)} de {formatRange(w.target)} kcal</span>}
              </span>
              <span className="hist-week-state">{WEEK_STATE[w.level]}</span>
            </li>
          ))}
        </ul>
      )}
      {pattern?.line && (
        <p>
          {pattern.line}
          {show && pattern.weekday && pattern.weekend && (
            <span className="hint">
              {' '}
              Entre semana ≈ {formatRange(pattern.weekday)} kcal por día; el finde ≈ {formatRange(pattern.weekend)}.
            </span>
          )}
        </p>
      )}
    </section>
  );
}

/** Acceso a "Tu progreso" con el último peso. */
function ProgressCard() {
  const profile = useStore((s) => s.profile)!;
  const body = useStore((s) => s.body);
  const p = bodyProgress(profile, body);
  return (
    <Link to="/progreso" className="glance progress-card">
      <span className="week-title">Tu progreso</span>
      <span>
        {p.last
          ? `Último peso: ${p.last.value.toLocaleString('es-AR')} kg${p.change !== undefined ? ` (${p.change > 0 ? '+' : p.change < 0 ? '−' : ''}${Math.abs(p.change).toLocaleString('es-AR')} kg desde que empezaste)` : ''}`
          : 'Anotá tu peso y medidas para ver cómo vas avanzando.'}
      </span>
      <span className="link">{p.last ? 'Ver y anotar ›' : 'Anotar ›'}</span>
    </Link>
  );
}
