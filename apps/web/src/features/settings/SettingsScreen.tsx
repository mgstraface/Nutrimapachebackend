import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GOAL_LABELS, estimateEnergy, formatRange, type BodySex, type Note, type Profile } from '@nutrimapache/shared';
import { api, errorText } from '../../lib/api';
import { RoutineSection } from './RoutineSection';
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

      <BodySection profile={profile} onSave={update} />
      <RoutineSection profile={profile} onSave={update} />

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
        <label className="toggle">
          <span>Soniditos de {profile.mascotName}</span>
          <input
            type="checkbox"
            checked={profile.view.sound !== false}
            onChange={(e) => void update({ ...profile, view: { ...profile.view, sound: e.target.checked } })}
          />
        </label>
      </section>

      <SavedNotes />

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
            Panel de admin: usuarios y alimentos
          </Link>
        )}
        <button type="button" className="btn-quiet" onClick={() => void logout()}>
          Cerrar sesión
        </button>
      </section>
    </div>
  );
}

/** Datos para la sugerencia orientativa de energía. Todo opcional. */
function BodySection({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => Promise<void> }) {
  const [age, setAge] = useState(profile.age ? String(profile.age) : '');
  const [height, setHeight] = useState(profile.heightCm ? String(profile.heightCm) : '');
  const [weight, setWeight] = useState(profile.weightKg ? String(profile.weightKg) : '');
  const [sex, setSex] = useState<BodySex | ''>(profile.sex ?? '');
  const [saved, setSaved] = useState(false);

  const n = (v: string) => {
    const x = parseFloat(v.replace(',', '.'));
    return Number.isFinite(x) && x > 0 ? x : undefined;
  };
  const draft: Profile = {
    ...profile,
    age: n(age) ? Math.round(n(age)!) : undefined,
    heightCm: n(height),
    weightKg: n(weight),
    sex: sex || undefined,
  };
  const valid =
    (!draft.age || (draft.age >= 14 && draft.age <= 110)) &&
    (!draft.heightCm || (draft.heightCm >= 120 && draft.heightCm <= 230)) &&
    (!draft.weightKg || (draft.weightKg >= 30 && draft.weightKg <= 300));
  const estimate = valid ? estimateEnergy(draft) : null;
  const changed = draft.age !== profile.age || draft.heightCm !== profile.heightCm || draft.weightKg !== profile.weightKg || draft.sex !== profile.sex;

  return (
    <section className="group">
      <h2>Tu cuerpo y tu energía</h2>
      <p className="hint">Opcional. Sirve para sugerirte un rango de energía diaria y ajustar las ideas de comidas. Solo lo ves vos.</p>
      <div className="body-grid">
        <label className="field">
          <span>Edad</span>
          <input inputMode="numeric" value={age} onChange={(e) => { setAge(e.target.value); setSaved(false); }} placeholder="32" />
        </label>
        <label className="field">
          <span>Altura (cm)</span>
          <input inputMode="numeric" value={height} onChange={(e) => { setHeight(e.target.value); setSaved(false); }} placeholder="165" />
        </label>
        <label className="field">
          <span>Peso (kg)</span>
          <input inputMode="decimal" value={weight} onChange={(e) => { setWeight(e.target.value); setSaved(false); }} placeholder="62" />
        </label>
        <label className="field">
          <span>Para la fórmula</span>
          <select value={sex} onChange={(e) => { setSex(e.target.value as BodySex | ''); setSaved(false); }}>
            <option value="">Elegí</option>
            <option value="femenino">Femenino</option>
            <option value="masculino">Masculino</option>
            <option value="no-decir">Prefiero no decir</option>
          </select>
        </label>
      </div>
      {!valid && <p className="form-error">Revisá los números: edad entre 14 y 110, altura entre 120 y 230 cm, peso entre 30 y 300 kg.</p>}

      {estimate && (
        <div className="energy-card">
          <p className="energy-main">
            Sugerencia orientativa: <strong>{formatRange(estimate.kcal, 'kcal')}</strong> por día
          </p>
          <p className="energy-sub">Proteína: {formatRange(estimate.protein, 'g')} por día</p>
          <p className="hint">{estimate.explanation}</p>
          <p className="hint">
            Es una estimación general, no una indicación médica. Tu hambre, tu energía y cómo te sentís valen más que el número. Si querés un plan a medida,
            lo ideal es verlo con una nutricionista.
          </p>
        </div>
      )}

      <button
        type="button"
        className="btn-primary"
        disabled={!changed || !valid}
        onClick={async () => {
          await onSave(draft);
          setSaved(true);
        }}
      >
        {saved && !changed ? 'Guardado' : 'Guardar datos'}
      </button>
    </section>
  );
}

/** Las notitas que ya trajo Cachete, para releerlas. */
function SavedNotes() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  useEffect(() => {
    api<Note[]>('/notes')
      .then(setNotes)
      .catch(() => setNotes([]));
  }, []);
  if (!notes || notes.length === 0) return null;
  return (
    <section className="group">
      <h2>Tus notitas 💌</h2>
      <ul className="notes-list">
        {notes.map((n) => (
          <li key={n.id}>
            <p>{n.text}</p>
            <p className="hint">
              De {n.fromName}
              {n.openedAt ? ` · ${new Date(n.openedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
