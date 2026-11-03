import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { AdminUserRow, Note, SpecialDate, SpecialKind } from '@nutrimapache/shared';
import { api, errorText } from '../../lib/api';
import { useStore } from '../../lib/store';
import { FoodsAdmin } from './FoodsAdmin';

/** Panel del admin: crear cuentas, cambiar contraseñas, pausar o borrar usuarios. */
export function AdminScreen() {
  const me = useStore((s) => s.user)!;
  const hasProfile = useStore((s) => !!s.profile);
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await api<AdminUserRow[]>('/admin/users'));
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string): Promise<boolean> => {
    setNotice(null);
    setError(null);
    try {
      await fn();
      setNotice(ok);
      await load();
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    }
  };

  return (
    <div className="page admin">
      <Link to={hasProfile ? '/yo' : '/'} className="back-link">
        Volver
      </Link>
      <h1 className="page-title">Usuarios</h1>
      <p className="muted">Las cuentas se crean solo desde acá. Pasale a cada persona su usuario y contraseña.</p>

      {notice && (
        <p className="form-ok" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <CreateUser onCreate={(data) => run(() => api('/admin/users', { method: 'POST', body: data }), `Listo: creamos la cuenta "${data.username}".`)} />

      <section className="group">
        <h2>Cuentas</h2>
        {users === null && !error && <p className="muted">Cargando…</p>}
        {users?.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            isMe={u.id === me.id}
            onPassword={(password) => run(() => api(`/admin/users/${u.id}`, { method: 'PATCH', body: { password } }), `Contraseña de "${u.username}" cambiada.`)}
            onToggle={() =>
              run(
                () => api(`/admin/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } }),
                u.active ? `"${u.username}" no puede entrar hasta que la reactives.` : `"${u.username}" puede volver a entrar.`,
              )
            }
            onDelete={() => {
              if (confirm(`Esto borra la cuenta "${u.username}" con su perfil y todas sus comidas. No se puede deshacer. ¿Seguimos?`)) {
                void run(() => api(`/admin/users/${u.id}`, { method: 'DELETE' }), `Borramos la cuenta "${u.username}".`);
              }
            }}
          />
        ))}
      </section>

      <FoodsAdmin />
    </div>
  );
}

function CreateUser({ onCreate }: { onCreate: (d: { username: string; displayName: string; password: string }) => Promise<boolean> }) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onCreate({ displayName: displayName.trim(), username: username.trim().toLowerCase(), password });
    setBusy(false);
    if (!ok) return;
    setDisplayName('');
    setUsername('');
    setPassword('');
  };

  return (
    <form className="group admin-card" onSubmit={submit}>
      <h2>Crear cuenta</h2>
      <label className="field">
        <span>Nombre</span>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Sara" maxLength={40} />
      </label>
      <label className="field">
        <span>Usuario para entrar</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="sara"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={30}
        />
      </label>
      <label className="field">
        <span>Contraseña</span>
        <PasswordInput value={password} onChange={setPassword} />
      </label>
      <button className="btn-primary" type="submit" disabled={busy || !displayName.trim() || username.trim().length < 3 || password.length < 6}>
        {busy ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  );
}

function UserRow({
  user: u,
  isMe,
  onPassword,
  onToggle,
  onDelete,
}: {
  user: AdminUserRow;
  isMe: boolean;
  onPassword: (p: string) => Promise<boolean>;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState('');
  const [showExtras, setShowExtras] = useState(false);

  const last = u.lastMealAt ? new Date(u.lastMealAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : null;

  return (
    <article className={`user-row${u.active ? '' : ' is-off'}`}>
      <div className="user-head">
        <div>
          <strong>{u.displayName}</strong>
          <span className="user-handle">
            {u.username}
            {u.role === 'admin' ? ' · admin' : ''}
            {isMe ? ' · vos' : ''}
          </span>
        </div>
        {!u.active && <span className="chip chip-quiet">Pausada</span>}
      </div>
      <p className="hint">
        {u.hasProfile ? 'Perfil armado' : 'Todavía no armó su perfil'}
        {' · '}
        {u.mealCount === 1 ? '1 comida anotada' : `${u.mealCount} comidas anotadas`}
        {last ? ` · última el ${last}` : ''}
      </p>

      {editing ? (
        <form
          className="user-pass"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onPassword(password)) {
              setPassword('');
              setEditing(false);
            }
          }}
        >
          <PasswordInput value={password} onChange={setPassword} placeholder="Nueva contraseña" />
          <div className="user-actions">
            <button type="button" className="btn-quiet" onClick={() => setEditing(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={password.length < 6}>
              Guardar contraseña
            </button>
          </div>
        </form>
      ) : (
        <div className="user-actions">
          <button type="button" className="btn-quiet" onClick={() => setEditing(true)}>
            Cambiar contraseña
          </button>
          <button type="button" className="btn-quiet" aria-expanded={showExtras} onClick={() => setShowExtras(!showExtras)}>
            💌 Notitas y fechas
          </button>
          {!isMe && (
            <>
              <button type="button" className="btn-quiet" onClick={onToggle}>
                {u.active ? 'Pausar' : 'Reactivar'}
              </button>
              <button type="button" className="btn-quiet btn-danger" onClick={onDelete}>
                Borrar
              </button>
            </>
          )}
        </div>
      )}
      {showExtras && <UserExtras userId={u.id} name={u.displayName} />}
    </article>
  );
}

const KIND_LABEL: Record<SpecialKind, string> = { cumple: 'Cumpleaños', aniversario: 'Aniversario', otro: 'Otro' };

/** Notitas que Cachete le entrega y fechas especiales (se repiten cada año). */
function UserExtras({ userId, name }: { userId: string; name: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [dates, setDates] = useState<SpecialDate[]>([]);
  const [text, setText] = useState('');
  const [deliverOn, setDeliverOn] = useState('');
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<SpecialKind>('cumple');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ notes: Note[]; dates: SpecialDate[] }>(`/admin/users/${userId}/extras`);
      setNotes(r.notes);
      setDates(r.dates);
    } catch (err) {
      setError(errorText(err));
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const fmt = (md: string) => {
    const [m, d] = md.split('-');
    return new Date(2000, Number(m) - 1, Number(d)).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
  };

  return (
    <div className="user-extras">
      {error && <p className="form-error">{error}</p>}

      <h4>Notitas para {name}</h4>
      <p className="hint">Cachete se la muestra con un sobrecito la próxima vez que abra la app (o desde el día que elijas).</p>
      <label className="field">
        <span>Mensaje</span>
        <textarea rows={3} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej.: Estoy re orgulloso de vos 💛" />
      </label>
      <label className="field">
        <span>Entregar a partir del (opcional)</span>
        <input type="date" value={deliverOn} onChange={(e) => setDeliverOn(e.target.value)} />
      </label>
      <button
        type="button"
        className="btn-primary btn-small"
        disabled={busy || !text.trim()}
        onClick={async () => {
          if (await run(() => api(`/admin/users/${userId}/notes`, { method: 'POST', body: { text: text.trim(), deliverOn: deliverOn || null } }))) {
            setText('');
            setDeliverOn('');
          }
        }}
      >
        Dejar notita
      </button>
      {notes.length > 0 && (
        <ul className="extras-list">
          {notes.map((n) => (
            <li key={n.id}>
              <span>
                “{n.text.length > 80 ? `${n.text.slice(0, 80)}…` : n.text}”
                <br />
                <span className="hint">
                  {n.openedAt
                    ? `Leída el ${new Date(n.openedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`
                    : n.deliverOn
                      ? `Se entrega desde el ${new Date(`${n.deliverOn}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`
                      : 'Esperando que la abra'}
                </span>
              </span>
              <button type="button" className="icon-btn" aria-label="Borrar notita" onClick={() => void run(() => api(`/admin/notes/${n.id}`, { method: 'DELETE' }))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <h4>Fechas especiales</h4>
      <p className="hint">Ese día Cachete se pone el gorrito de fiesta y tira confeti. Se repite todos los años.</p>
      <div className="extras-row">
        <label className="field">
          <span>Día</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Tipo</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as SpecialKind)}>
            <option value="cumple">Cumpleaños</option>
            <option value="aniversario">Aniversario</option>
            <option value="otro">Otro</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Nombre</span>
        <input value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder={kind === 'cumple' ? 'Cumple de Sara' : kind === 'aniversario' ? 'aniversario' : 'Día del…'} />
      </label>
      <button
        type="button"
        className="btn-primary btn-small"
        disabled={busy || !date || !label.trim()}
        onClick={async () => {
          if (await run(() => api(`/admin/users/${userId}/dates`, { method: 'POST', body: { monthDay: date.slice(5), label: label.trim(), kind } }))) {
            setDate('');
            setLabel('');
          }
        }}
      >
        Agregar fecha
      </button>
      {dates.length > 0 && (
        <ul className="extras-list">
          {dates.map((d) => (
            <li key={d.id}>
              <span>
                {fmt(d.monthDay)} · {d.label} <span className="hint">({KIND_LABEL[d.kind]})</span>
              </span>
              <button type="button" className="icon-btn" aria-label="Borrar fecha" onClick={() => void run(() => api(`/admin/dates/${d.id}`, { method: 'DELETE' }))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Campo de contraseña con botón para verla y otro para generar una fácil de dictar. */
function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pass-row">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Mínimo 6 caracteres'}
        autoComplete="new-password"
        autoCapitalize="none"
        autoCorrect="off"
      />
      <button type="button" className="btn-quiet btn-small" onClick={() => setShow(!show)}>
        {show ? 'Ocultar' : 'Ver'}
      </button>
      <button
        type="button"
        className="btn-quiet btn-small"
        onClick={() => {
          onChange(friendlyPassword());
          setShow(true);
        }}
      >
        Generar
      </button>
    </div>
  );
}

const WORDS = ['mate', 'luna', 'tejido', 'cachete', 'nube', 'alfajor', 'sol', 'trenza', 'cerro', 'quinoa', 'manta', 'estrella'];

/** Dos palabras + número: segura para este uso y fácil de pasar por WhatsApp. */
function friendlyPassword(): string {
  const r = new Uint32Array(3);
  crypto.getRandomValues(r);
  const w = (n: number) => WORDS[n % WORDS.length]!;
  return `${w(r[0]!)}-${w(r[1]!)}-${10 + (r[2]! % 90)}`;
}
