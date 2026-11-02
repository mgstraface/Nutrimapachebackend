import { useState, type FormEvent } from 'react';
import { Cachete } from '../../mascot/Cachete';
import { errorText } from '../../lib/api';
import { useStore } from '../../lib/store';

export function LoginScreen() {
  const login = useStore((s) => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim().toLowerCase(), password);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="onb">
      <div className="onb-den">
        <Cachete expression={error ? 'acompañamiento' : 'alegria'} size={136} />
      </div>
      <form className="onb-card" onSubmit={submit}>
        <h1>¡Hola de nuevo!</h1>
        <p className="onb-lead">Entrá con el usuario y la contraseña que te pasaron.</p>
        <label className="field">
          <span>Usuario</span>
          <input
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn-primary" type="submit" disabled={busy || !username.trim() || !password}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="hint">¿Te olvidaste la contraseña? Pedile a quien administra la app que te asigne una nueva.</p>
      </form>
    </div>
  );
}
