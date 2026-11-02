import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GOAL_LABELS, type Profile } from '@nutrimapache/shared';
import { errorText } from '../../lib/api';
import { useStore } from '../../lib/store';

export function SettingsScreen() {
  const profile = useStore((s) => s.profile)!;
  const user = useStore((s) => s.user)!;
  const saveProfile = useStore((s) => s.saveProfile);
  const wipeData = useStore((s) => s.wipeData);
  const logout = useStore((s) => s.logout);
  const [error, setError] = useState<string | null>(null);

  const update = async (p: Profile) => {
    setError(null);
    try {
      await saveProfile(p);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">{profile.displayName}</h1>
      <p className="muted">
        {GOAL_LABELS[profile.goal]} · usuario <strong>{user.username}</strong>
      </p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <section className="group">
        <h2>Qué querés ver</h2>
        <label className="toggle">
          <span>Mostrar calorías estimadas</span>
          <input
            type="checkbox"
            checked={profile.view.showCalories}
            onChange={(e) => void update({ ...profile, view: { ...profile.view, showCalories: e.target.checked } })}
          />
        </label>
        <label className="toggle">
          <span>Mostrar proteínas y macros</span>
          <input
            type="checkbox"
            checked={profile.view.showMacros}
            onChange={(e) => void update({ ...profile, view: { ...profile.view, showMacros: e.target.checked } })}
          />
        </label>
        <p className="hint">Siempre van a aparecer como rango aproximado, nunca como un número exacto.</p>
      </section>

      <section className="group">
        <h2>Fotos</h2>
        <label className="toggle">
          <span>Analizar fotos de comidas con IA</span>
          <input
            type="checkbox"
            checked={profile.consents.aiAnalysis}
            onChange={(e) =>
              void update({
                ...profile,
                consents: { ...profile.consents, aiAnalysis: e.target.checked, acceptedAt: e.target.checked ? new Date().toISOString() : profile.consents.acceptedAt },
              })
            }
          />
        </label>
        <p className="hint">
          La foto se envía achicada y sin datos tuyos a Claude (Anthropic) para reconocer los ingredientes. No se guarda: se analiza y se descarta.
        </p>
      </section>

      <section className="group">
        <h2>Tus datos</h2>
        <p className="hint">Se guardan en tu cuenta, así los ves desde cualquier dispositivo. Solo vos podés verlos.</p>
        {/* Descarga directa: el servidor responde el archivo con la cookie de sesión */}
        <a className="btn-quiet btn-link" href="/api/v1/privacy/export" download>
          Exportar mis datos
        </a>
        <button
          type="button"
          className="btn-quiet"
          onClick={async () => {
            if (!confirm('Esto borra tu perfil y todas tus comidas. Tu cuenta sigue existiendo y podés volver a empezar. ¿Seguimos?')) return;
            try {
              await wipeData();
            } catch (err) {
              setError(errorText(err));
            }
          }}
        >
          Borrar mis datos
        </button>
      </section>

      <section className="group">
        <h2>Cuenta</h2>
        {user.role === 'admin' && (
          <Link to="/admin" className="btn-quiet btn-link">
            Administrar usuarios
          </Link>
        )}
        <button type="button" className="btn-quiet" onClick={() => void logout()}>
          Cerrar sesión
        </button>
      </section>
    </div>
  );
}
