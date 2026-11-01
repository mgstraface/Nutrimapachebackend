import { GOAL_LABELS } from '@nutrimapache/shared';
import { useStore } from '../../lib/store';

export function SettingsScreen() {
  const profile = useStore((s) => s.profile)!;
  const meals = useStore((s) => s.meals);
  const setProfile = useStore((s) => s.setProfile);
  const wipe = useStore((s) => s.wipe);

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), profile, meals }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nutrimapache-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="page">
      <h1 className="page-title">{profile.displayName}</h1>
      <p className="muted">{GOAL_LABELS[profile.goal]}</p>

      <section className="group">
        <h2>Qué querés ver</h2>
        <label className="toggle">
          <span>Mostrar calorías estimadas</span>
          <input
            type="checkbox"
            checked={profile.view.showCalories}
            onChange={(e) => setProfile({ ...profile, view: { ...profile.view, showCalories: e.target.checked } })}
          />
        </label>
        <label className="toggle">
          <span>Mostrar proteínas y macros</span>
          <input
            type="checkbox"
            checked={profile.view.showMacros}
            onChange={(e) => setProfile({ ...profile, view: { ...profile.view, showMacros: e.target.checked } })}
          />
        </label>
        <p className="hint">Siempre van a aparecer como rango aproximado, nunca como un número exacto.</p>
      </section>

      <section className="group">
        <h2>Tus datos</h2>
        <p className="hint">Por ahora todo queda guardado solo en este teléfono.</p>
        <button type="button" className="btn-quiet" onClick={exportData}>
          Exportar mis datos
        </button>
        <button
          type="button"
          className="btn-quiet"
          onClick={() => {
            if (confirm('Esto borra tu perfil y todas tus comidas de este teléfono. ¿Seguimos?')) wipe();
          }}
        >
          Borrar todo
        </button>
      </section>
    </div>
  );
}
