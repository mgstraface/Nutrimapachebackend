import { useStore } from '../../lib/store';

export function HistoryScreen() {
  const meals = useStore((s) => s.meals);
  const profile = useStore((s) => s.profile)!;
  const label = (key: string) => profile.mealSlots.find((s) => s.key === key)?.label ?? 'Otro momento';

  const byDay = meals.reduce<Record<string, typeof meals>>((acc, m) => {
    (acc[m.date] ??= []).push(m);
    return acc;
  }, {});
  const days = Object.keys(byDay).sort().reverse();

  return (
    <div className="page">
      <h1 className="page-title">Historial</h1>
      {days.length === 0 ? (
        <p className="empty">Cuando anotes tu primera comida, la vas a ver acá.</p>
      ) : (
        days.map((d) => (
          <section key={d} className="hist-day">
            <h2>{new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
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
          </section>
        ))
      )}
    </div>
  );
}
