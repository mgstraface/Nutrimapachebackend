import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { bodyProgress, MEASURES, type BodyEntry, type BodyEntryInput, type MeasureKey } from '@nutrimapache/shared';
import { errorText } from '../../lib/api';
import { localDate, useStore } from '../../lib/store';

const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', opts);
const kg = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`;
const signed = (n: number, unit: string) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${unit}`;
/** "82,5" o "82.5" → 82.5; vacío → null */
const num = (s: string) => {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

/** Peso y medidas: anotar y ver cómo viene. Siempre en tono de tendencia, nunca de un día suelto. */
export function ProgressScreen() {
  const profile = useStore((s) => s.profile)!;
  const body = useStore((s) => s.body);
  const saveBody = useStore((s) => s.saveBody);
  const deleteBody = useStore((s) => s.deleteBody);
  const today = localDate();

  const progress = useMemo(() => bodyProgress(profile, body), [profile, body]);
  const [date, setDate] = useState(today);
  const existing = body.find((b) => b.date === date);
  const [weight, setWeight] = useState('');
  const [measures, setMeasures] = useState<Record<MeasureKey, string>>(() => emptyMeasures());
  const [note, setNote] = useState('');
  const [showMeasures, setShowMeasures] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Al elegir una fecha que ya tiene registro, se carga para editarlo
  useEffect(() => {
    setWeight(existing?.weightKg != null ? String(existing.weightKg).replace('.', ',') : '');
    setMeasures(
      Object.fromEntries(MEASURES.map((m) => [m.key, existing?.[m.key] != null ? String(existing[m.key]).replace('.', ',') : ''])) as Record<MeasureKey, string>,
    );
    setNote(existing?.note ?? '');
    if (existing && MEASURES.some((m) => existing[m.key] != null)) setShowMeasures(true);
    setSaved(false);
  }, [date, existing?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const entry: BodyEntryInput = {
    weightKg: num(weight),
    ...(Object.fromEntries(MEASURES.map((m) => [m.key, num(measures[m.key])])) as Record<MeasureKey, number | null>),
    note: note.trim(),
  };
  const values = [entry.weightKg, ...MEASURES.map((m) => entry[m.key])];
  const invalid =
    values.some((v) => Number.isNaN(v)) ||
    (entry.weightKg !== null && (entry.weightKg < 30 || entry.weightKg > 300)) ||
    MEASURES.some((m) => entry[m.key] !== null && (entry[m.key]! < 10 || entry[m.key]! > 250));
  const empty = values.every((v) => v === null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveBody(date, entry);
      setSaved(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: string) => {
    if (!confirm(`¿Borrar el registro del ${fmtDate(d, { day: 'numeric', month: 'long' })}?`)) return;
    try {
      await deleteBody(d);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="page progress">
      <Link className="back-link" to="/historial">
        ‹ Historial
      </Link>
      <h1 className="page-title">Tu progreso</h1>

      {progress.last && (
        <section className="glance progress-summary" aria-label="Cómo viene el peso">
          <div className="progress-hero">
            <span className="progress-big">{kg(progress.last.value)}</span>
            <span className="hint">
              {fmtDate(progress.last.date, { day: 'numeric', month: 'long' })}
              {progress.change !== undefined && progress.first && ` · ${signed(progress.change, 'kg')} desde el ${fmtDate(progress.first.date)}`}
            </span>
          </div>
          {progress.weights.length >= 2 && <WeightChart points={progress.weights} />}
          {progress.line && <p>{progress.line}</p>}
          {progress.care && <p className="hint">{progress.care}</p>}
          {progress.measures.length > 0 && (
            <ul className="progress-measures">
              {progress.measures.map((m) => (
                <li key={m.key}>
                  <span>{m.label}</span>
                  <span>
                    {m.last.value.toLocaleString('es-AR')} cm <span className="hint">({signed(m.change, 'cm')} desde el {fmtDate(m.first.date)})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="group progress-form">
        <h2>{existing ? 'Editar registro' : 'Anotar'}</h2>
        <p className="hint">Una vez por semana alcanza. Mejor siempre a la misma hora, en ayunas y después del baño.</p>
        <div className="body-grid">
          <label className="field">
            <span>Fecha</span>
            <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Peso (kg)</span>
            <input inputMode="decimal" value={weight} onChange={(e) => { setWeight(e.target.value); setSaved(false); }} placeholder={profile.weightKg ? String(profile.weightKg).replace('.', ',') : '70,5'} />
          </label>
        </div>

        {showMeasures ? (
          <div className="body-grid">
            {MEASURES.map((m) => (
              <label key={m.key} className="field">
                <span>{m.label} (cm)</span>
                <input
                  inputMode="decimal"
                  value={measures[m.key]}
                  onChange={(e) => {
                    setMeasures((prev) => ({ ...prev, [m.key]: e.target.value }));
                    setSaved(false);
                  }}
                />
              </label>
            ))}
          </div>
        ) : (
          <button type="button" className="btn-quiet btn-small" onClick={() => setShowMeasures(true)}>
            + Sumar medidas (cintura, cadera…)
          </button>
        )}
        {showMeasures && <p className="hint">Con la cinta justa pero sin apretar: cintura a la altura del ombligo, cadera en la parte más ancha.</p>}

        <label className="field">
          <span>Nota (opcional)</span>
          <input value={note} maxLength={200} onChange={(e) => { setNote(e.target.value); setSaved(false); }} placeholder="Ej.: después de un finde largo" />
        </label>

        {invalid && <p className="form-error">Revisá los números: peso entre 30 y 300 kg, medidas entre 10 y 250 cm.</p>}
        {error && <p className="form-error">{error}</p>}
        <button type="button" className="btn-primary" disabled={busy || invalid || empty} onClick={() => void save()}>
          {busy ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar'}
        </button>
        {saved && entry.weightKg !== null && date >= (progress.last?.date ?? '') && (
          <p className="hint">También actualicé tu peso en Yo, así el rango de energía queda al día.</p>
        )}
      </section>

      {body.length > 0 && (
        <section className="group">
          <h2>Registros</h2>
          <ul className="progress-list">
            {[...body].reverse().map((b) => (
              <li key={b.date}>
                <button type="button" className="progress-row" onClick={() => setDate(b.date)} aria-label={`Editar el registro del ${fmtDate(b.date, { day: 'numeric', month: 'long' })}`}>
                  <span className="progress-row-date">{fmtDate(b.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span>{rowText(b)}</span>
                </button>
                <button type="button" className="link" onClick={() => void remove(b.date)} aria-label="Borrar">
                  Borrar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const emptyMeasures = () => Object.fromEntries(MEASURES.map((m) => [m.key, ''])) as Record<MeasureKey, string>;

function rowText(b: BodyEntry) {
  const parts = [
    b.weightKg !== null ? kg(b.weightKg) : null,
    ...MEASURES.filter((m) => b[m.key] !== null).map((m) => `${m.label.toLowerCase()} ${b[m.key]!.toLocaleString('es-AR')}`),
  ].filter(Boolean);
  return parts.join(' · ') + (b.note ? ` — “${b.note}”` : '');
}

/**
 * Línea del peso en el tiempo: una sola serie (sin leyenda), línea de 2 px, puntos de 8 px,
 * grilla tenue y tooltip al tocar un punto. La tabla de "Registros" de abajo es la vista en texto.
 */
function WeightChart({ points }: { points: { date: string; value: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const W = 320;
  const H = 150;
  const pad = { l: 34, r: 10, t: 12, b: 22 };
  const t = (d: string) => new Date(`${d}T12:00:00`).getTime();
  const t0 = t(points[0]!.date);
  const t1 = Math.max(t(points.at(-1)!.date), t0 + 864e5);
  const vals = points.map((p) => p.value);
  const lo = Math.floor(Math.min(...vals) - 0.5);
  const hi = Math.ceil(Math.max(...vals) + 0.5);
  const x = (d: string) => pad.l + ((t(d) - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const ticks = [lo, (lo + hi) / 2, hi].map((v) => Math.round(v * 10) / 10);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const a = active !== null ? points[active] : null;

  return (
    <figure className="weight-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Peso del ${fmtDate(points[0]!.date)} al ${fmtDate(points.at(-1)!.date)}: de ${kg(points[0]!.value)} a ${kg(points.at(-1)!.value)}`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="wc-grid" />
            <text x={pad.l - 6} y={y(v) + 3.5} className="wc-axis" textAnchor="end">
              {v.toLocaleString('es-AR')}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} className="wc-axis">
          {fmtDate(points[0]!.date)}
        </text>
        <text x={W - pad.r} y={H - 6} className="wc-axis" textAnchor="end">
          {fmtDate(points.at(-1)!.date)}
        </text>
        <path d={path} className="wc-line" />
        {a && <line x1={x(a.date)} x2={x(a.date)} y1={pad.t} y2={H - pad.b} className="wc-cross" />}
        {points.map((p, i) => (
          <g key={p.date}>
            <circle cx={x(p.date)} cy={y(p.value)} r={i === active ? 5.5 : 4} className="wc-dot" />
            {/* Zona de toque más grande que el punto */}
            <circle
              cx={x(p.date)}
              cy={y(p.value)}
              r="14"
              className="wc-hit"
              onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)}
              // Con mouse se va al salir; con el dedo queda fijo hasta tocar otro punto
              onPointerLeave={(e) => e.pointerType === 'mouse' && setActive((cur) => (cur === i ? null : cur))}
            />
          </g>
        ))}
      </svg>
      {a ? (
        <figcaption className="wc-tip">
          {fmtDate(a.date, { weekday: 'short', day: 'numeric', month: 'short' })}: <strong>{kg(a.value)}</strong>
        </figcaption>
      ) : (
        <figcaption className="hint">Tocá un punto para ver el detalle.</figcaption>
      )}
    </figure>
  );
}
