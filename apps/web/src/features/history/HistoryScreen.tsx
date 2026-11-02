import { plannedFor, summarizeDay } from '@nutrimapache/shared';
import { useStore } from '../../lib/store';

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
  const dates = [...new Set([...Object.keys(byDay), ...Object.keys(days).filter(hasLog)])].sort().reverse();

  return (
    <div className="page">
      <h1 className="page-title">Historial</h1>
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
              <h2>{when.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
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
