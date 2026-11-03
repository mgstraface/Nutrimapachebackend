import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { fold, foodsToCsv, parseFoodsCsv, setFoods, suggestedKcal, type Food, type FoodCsvResult, type FoodGroup, type FoodInput } from '@nutrimapache/shared';
import { api, errorText } from '../../lib/api';

const GROUPS: FoodGroup[] = ['proteína', 'verdura', 'fruta', 'cereal', 'lácteo', 'grasa', 'bebida', 'otro'];
const UNITS: FoodInput['unit'][] = ['g', 'ml', 'unidad', 'porción', 'taza', 'cda'];

const EMPTY: Draft = { name: '', group: 'otro', kcal: '', protein: '', unit: 'g', qty: '100', each: '', aliases: '' };

/** Campos como texto mientras se editan (para permitir "2,5", vacío, etc.). */
interface Draft {
  name: string;
  group: FoodGroup;
  kcal: string;
  protein: string;
  unit: FoodInput['unit'];
  qty: string;
  each: string;
  aliases: string;
}

const toDraft = (f: Food): Draft => ({
  name: f.name,
  group: f.group,
  kcal: String(f.kcal),
  protein: String(f.protein),
  unit: f.unit,
  qty: String(f.qty),
  each: f.each ? String(f.each) : '',
  aliases: (f.aliases ?? []).join(', '),
});

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

/** Catálogo de alimentos: lo que usa el buscador de ingredientes para estimar sin IA. */
export function FoodsAdmin() {
  const [foods, setList] = useState<Food[] | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Planilla leída, esperando confirmación */
  const [upload, setUpload] = useState<(FoodCsvResult & { file: string }) | null>(null);
  const [importing, setImporting] = useState(false);

  const reload = () =>
    api<Food[]>('/foods')
      .then(apply)
      .catch((err) => setError(errorText(err)));

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = () => {
    const blob = new Blob([foodsToCsv(foods ?? [])], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alimentos-cachete-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setNotice(null);
    setError(null);
    if (/\.xlsx?$/i.test(file.name)) {
      setError('Ese es el archivo de Excel. Guardalo como "CSV UTF-8 (delimitado por comas)" y subí ese.');
      return;
    }
    setUpload({ ...parseFoodsCsv(await file.text()), file: file.name });
  };

  const confirmUpload = async () => {
    if (!upload?.foods.length) return;
    setImporting(true);
    setError(null);
    try {
      const r = await api<{ created: number; updated: number }>('/admin/foods/bulk', { method: 'POST', body: { foods: upload.foods } });
      setNotice(`Listo: ${r.created} nuevos y ${r.updated} actualizados.`);
      setUpload(null);
      await reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setImporting(false);
    }
  };

  const existingNames = useMemo(() => new Set((foods ?? []).map((f) => fold(f.name))), [foods]);
  const uploadNew = upload ? upload.foods.filter((f) => !existingNames.has(fold(f.name))).length : 0;

  const apply = (list: Food[]) => {
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    setList(sorted);
    setFoods(sorted); // el buscador de esta sesión usa lo nuevo al instante
  };

  const shown = useMemo(() => {
    if (!foods) return [];
    const f = fold(q);
    return f ? foods.filter((x) => fold(x.name).includes(f) || (x.aliases ?? []).some((a) => fold(a).includes(f))) : foods;
  }, [foods, q]);

  const save = async (id: string | 'new', input: FoodInput) => {
    const saved =
      id === 'new'
        ? await api<Food>('/admin/foods', { method: 'POST', body: input })
        : await api<Food>(`/admin/foods/${id}`, { method: 'PUT', body: input });
    apply(id === 'new' ? [...(foods ?? []), saved] : (foods ?? []).map((f) => (f.id === id ? saved : f)));
    setEditing(null);
  };

  const remove = async (f: Food) => {
    if (!f.id || !confirm(`¿Borrar "${f.name}" del catálogo? Las comidas ya anotadas no cambian.`)) return;
    try {
      await api(`/admin/foods/${f.id}`, { method: 'DELETE' });
      apply((foods ?? []).filter((x) => x.id !== f.id));
      setEditing(null);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <section className="group foods-admin">
      <h2>Alimentos {foods ? <span className="muted">({foods.length})</span> : null}</h2>
      <p className="hint">
        Lo que usa el buscador de ingredientes para calcular sin IA. Valores cada 100 g (o 100 ml). Los cambios valen para lo que se anote de acá en adelante.
      </p>

      <div className="pantry-add">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar alimento" aria-label="Buscar alimento" />
        <button type="button" className="btn-primary btn-small" onClick={() => setEditing('new')}>
          Nuevo
        </button>
      </div>

      <div className="foods-bulk">
        <button type="button" className="btn-quiet btn-small" disabled={!foods?.length} onClick={download}>
          Descargar planilla
        </button>
        <label className="btn-quiet btn-small btn-file">
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => void onFile(e)} />
          Subir planilla
        </label>
      </div>

      {upload && (
        <div className="food-form">
          <strong>{upload.file}</strong>
          {upload.foods.length > 0 ? (
            <p>
              Se van a cargar <strong>{upload.foods.length}</strong> alimentos: {uploadNew} nuevos y {upload.foods.length - uploadNew} que ya existen y se
              actualizan. Los que no están en la planilla quedan como están.
            </p>
          ) : (
            <p>No encontramos filas para cargar.</p>
          )}
          {upload.errors.length > 0 && (
            <div className="bulk-errors">
              <p className="form-error">{upload.errors.length === 1 ? 'Una fila tiene un problema y no se va a cargar:' : `${upload.errors.length} filas tienen problemas y no se van a cargar:`}</p>
              <ul>
                {upload.errors.slice(0, 30).map((e) => (
                  <li key={e}>{e}</li>
                ))}
                {upload.errors.length > 30 && <li>… y {upload.errors.length - 30} más</li>}
              </ul>
            </div>
          )}
          <div className="food-form-actions">
            <button type="button" className="btn-quiet btn-small" disabled={importing} onClick={() => setUpload(null)}>
              Cancelar
            </button>
            <button type="button" className="btn-primary btn-small" disabled={importing || !upload.foods.length} onClick={() => void confirmUpload()}>
              {importing ? 'Cargando…' : 'Confirmar carga'}
            </button>
          </div>
        </div>
      )}

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

      {editing === 'new' && (
        <FoodForm initial={{ ...EMPTY, name: q.trim() }} onCancel={() => setEditing(null)} onSave={(input) => save('new', input)} />
      )}

      {foods === null && !error && <p className="muted">Cargando…</p>}
      <ul className="food-list">
        {shown.map((f) =>
          editing === f.id ? (
            <li key={f.id}>
              <FoodForm initial={toDraft(f)} onCancel={() => setEditing(null)} onSave={(input) => save(f.id!, input)} onDelete={() => void remove(f)} />
            </li>
          ) : (
            <li key={f.id ?? f.name}>
              <button type="button" className="food-row" onClick={() => setEditing(f.id ?? null)}>
                <span className="food-row-name">
                  {f.name}
                  {f.aliases && f.aliases.length > 0 && <small>{f.aliases.slice(0, 3).join(', ')}</small>}
                </span>
                <span className="food-row-nums">
                  {f.kcal} kcal · {f.protein} g prot <small className="inline">c/100 g</small>
                  <small>
                    {f.qty} {f.unit}
                    {f.each ? ` (${Math.round(f.qty * f.each)} g)` : ''}
                    {suggestedKcal(f) !== null ? ` ≈ ${suggestedKcal(f)} kcal` : ''}
                  </small>
                </span>
              </button>
            </li>
          ),
        )}
      </ul>
      {foods && shown.length === 0 && <p className="muted">No hay alimentos con "{q}". Tocá Nuevo para sumarlo.</p>}
    </section>
  );
}

function FoodForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: Draft;
  onSave: (f: FoodInput) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch });
  const perUnit = d.unit === 'unidad' || d.unit === 'porción';

  const submit = async () => {
    const input: FoodInput = {
      name: d.name.trim(),
      group: d.group,
      kcal: num(d.kcal),
      protein: num(d.protein),
      unit: d.unit,
      qty: num(d.qty),
      each: perUnit && d.each.trim() ? num(d.each) : undefined,
      aliases: d.aliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
    };
    if (input.name.length < 2) return setError('Poné un nombre.');
    if (!(input.kcal >= 0 && input.kcal <= 950)) return setError('Las calorías cada 100 g tienen que estar entre 0 y 950.');
    if (!(input.protein >= 0 && input.protein <= 100)) return setError('La proteína cada 100 g tiene que estar entre 0 y 100.');
    if (!(input.qty > 0)) return setError('Poné una cantidad sugerida.');
    if (perUnit && !(input.each! > 0)) return setError('Para unidad o porción, decí cuántos gramos pesa una.');
    setBusy(true);
    setError(null);
    try {
      await onSave(input);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  const k = num(d.kcal);
  const g = perUnit ? num(d.each) * num(d.qty) : num(d.qty);
  const preview = Number.isFinite(k) && g > 0 ? Math.round((k * g) / 100) : null;

  return (
    <div className="food-form">
      <label className="field">
        <span>Nombre</span>
        <input value={d.name} maxLength={50} onChange={(e) => set({ name: e.target.value })} placeholder="Ej: Tostada de pan" />
      </label>
      <div className="food-form-grid">
        <label className="field">
          <span>kcal cada 100 g</span>
          <input inputMode="decimal" value={d.kcal} onChange={(e) => set({ kcal: e.target.value })} placeholder="300" />
        </label>
        <label className="field">
          <span>Proteína (g) cada 100 g</span>
          <input inputMode="decimal" value={d.protein} onChange={(e) => set({ protein: e.target.value })} placeholder="9" />
        </label>
        <label className="field">
          <span>Grupo</span>
          <select value={d.group} onChange={(e) => set({ group: e.target.value as FoodGroup })}>
            {GROUPS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Se anota en</span>
          <select value={d.unit} onChange={(e) => set({ unit: e.target.value as FoodInput['unit'] })}>
            {UNITS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Cantidad sugerida</span>
          <input inputMode="decimal" value={d.qty} onChange={(e) => set({ qty: e.target.value })} placeholder="1" />
        </label>
        {perUnit && (
          <label className="field">
            <span>Gramos por {d.unit}</span>
            <input inputMode="decimal" value={d.each} onChange={(e) => set({ each: e.target.value })} placeholder="30" />
          </label>
        )}
      </div>
      <label className="field">
        <span>Otros nombres (separados por coma)</span>
        <input value={d.aliases} onChange={(e) => set({ aliases: e.target.value })} placeholder="tostadas, pan tostado" />
      </label>
      {preview !== null && (
        <p className="hint">
          Al elegirlo se carga: {d.qty} {d.unit}
          {perUnit && d.each ? ` (${g} g)` : ''} ≈ {preview} kcal
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="food-form-actions">
        {onDelete && (
          <button type="button" className="btn-quiet btn-small" disabled={busy} onClick={onDelete}>
            Borrar
          </button>
        )}
        <button type="button" className="btn-quiet btn-small" disabled={busy} onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn-primary btn-small" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
