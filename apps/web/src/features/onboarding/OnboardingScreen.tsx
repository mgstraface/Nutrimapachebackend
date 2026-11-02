import { useState } from 'react';
import {
  GOAL_LABELS,
  PROFILE_TEMPLATES,
  WEEKDAYS,
  type Goal,
  type MealSlot,
  type ProfileTemplate,
} from '@nutrimapache/shared';
import { Link } from 'react-router-dom';
import { Cachete } from '../../mascot/Cachete';
import { errorText } from '../../lib/api';
import { useStore } from '../../lib/store';

type Step = 'nombre' | 'plantilla' | 'comidas';

export function OnboardingScreen() {
  const saveProfile = useStore((s) => s.saveProfile);
  const user = useStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('nombre');
  const [name, setName] = useState(user?.displayName ?? '');
  const [mascotName, setMascotName] = useState('Cachete');
  const [template, setTemplate] = useState<ProfileTemplate>(PROFILE_TEMPLATES[0]!);
  const [goal, setGoal] = useState<Goal>(PROFILE_TEMPLATES[0]!.profile.goal);
  const [slots, setSlots] = useState<MealSlot[]>(PROFILE_TEMPLATES[0]!.profile.mealSlots);

  const chooseTemplate = (t: ProfileTemplate) => {
    setTemplate(t);
    setGoal(t.profile.goal);
    setSlots(t.profile.mealSlots.map((s) => ({ ...s })));
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveProfile({
        ...template.profile,
        displayName: name.trim(),
        mascotName: mascotName.trim() || 'Cachete',
        goal,
        mealSlots: slots.filter((s) => s.label.trim()),
        consents: { photoStorage: false, aiAnalysis: false, acceptedAt: null, version: '2026-11' },
      });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="onb">
      <div className="onb-den">
        <Cachete expression={step === 'nombre' ? 'alegria' : step === 'plantilla' ? 'curiosidad' : 'sorpresa'} size={136} />
      </div>

      {step === 'nombre' && (
        <form
          className="onb-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) setStep('plantilla');
          }}
        >
          <h1>¡Hola! Soy Cachete.</h1>
          <p className="onb-lead">Te acompaño con tus comidas, sin contar nada que no quieras y sin retos.</p>
          <label className="field">
            <span>¿Cómo te llamo?</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" maxLength={40} />
          </label>
          <label className="field">
            <span>¿Y vos cómo me llamás a mí?</span>
            <input value={mascotName} onChange={(e) => setMascotName(e.target.value)} maxLength={20} />
          </label>
          <button className="btn-primary" type="submit" disabled={!name.trim()}>
            Seguir
          </button>
        </form>
      )}

      {step === 'plantilla' && (
        <div className="onb-card">
          <h1>¿Cómo es tu semana?</h1>
          <p className="onb-lead">Elegí un punto de partida. Después cambiás lo que quieras.</p>
          <div className="choices">
            {PROFILE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`choice${template.id === t.id ? ' is-on' : ''}`}
                aria-pressed={template.id === t.id}
                onClick={() => chooseTemplate(t)}
              >
                <strong>{t.title}</strong>
                <span>{t.description}</span>
                {t.profile.routine.some((d) => d.trainingKey) && (
                  <span className="choice-week">
                    {t.profile.routine.map((d, i) => (
                      <abbr key={i} title={WEEKDAYS[i]} className={d.trainingKey ? 'on' : ''}>
                        {WEEKDAYS[i]!.slice(0, 1)}
                      </abbr>
                    ))}
                  </span>
                )}
              </button>
            ))}
          </div>
          <label className="field">
            <span>¿Qué buscás?</span>
            <select value={goal} onChange={(e) => setGoal(e.target.value as Goal)}>
              {Object.entries(GOAL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="onb-actions">
            <button type="button" className="btn-quiet" onClick={() => setStep('nombre')}>
              Volver
            </button>
            <button type="button" className="btn-primary" onClick={() => setStep('comidas')}>
              Seguir
            </button>
          </div>
        </div>
      )}

      {step === 'comidas' && (
        <div className="onb-card">
          <h1>Tus comidas del día</h1>
          <p className="onb-lead">Ponele el nombre y la hora que te queden cómodos. Entre 2 y 6.</p>
          <div className="slots">
            {slots.map((s, idx) => (
              <div key={s.key} className="slot-row">
                <input
                  aria-label="Nombre de la comida"
                  value={s.label}
                  maxLength={30}
                  onChange={(e) => setSlots(slots.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  aria-label="Hora aproximada"
                  type="time"
                  value={s.time}
                  onChange={(e) => setSlots(slots.map((x, i) => (i === idx ? { ...x, time: e.target.value } : x)))}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Quitar ${s.label}`}
                  disabled={slots.length <= 2}
                  onClick={() => setSlots(slots.filter((_, i) => i !== idx))}
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
              onClick={() => setSlots([...slots, { key: `comida-${Date.now().toString(36)}`, label: 'Colación', time: '11:00' }])}
            >
              Sumar una comida
            </button>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="onb-actions">
            <button type="button" className="btn-quiet" onClick={() => setStep('plantilla')}>
              Volver
            </button>
            <button type="button" className="btn-primary" onClick={() => void finish()} disabled={busy}>
              {busy ? 'Guardando…' : 'Empezar'}
            </button>
          </div>
        </div>
      )}

      {isAdmin && (
        <p className="onb-admin">
          <Link to="/admin">Ir al panel de usuarios</Link>
        </p>
      )}
    </div>
  );
}
