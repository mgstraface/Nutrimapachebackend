import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { MealSheet, type MealSheetTarget } from '../features/meals/MealSheet';
import { RegisterContext } from '../features/meals/registerContext';

const tabs = [
  { to: '/', label: 'Hoy', icon: IconHome, end: true },
  { to: '/semana', label: 'Semana', icon: IconWeek },
  { to: '/historial', label: 'Historial', icon: IconHistory },
  { to: '/yo', label: 'Yo', icon: IconMe },
];

export function Layout() {
  const [target, setTarget] = useState<MealSheetTarget | null>(null);

  return (
    <RegisterContext.Provider value={setTarget}>
      <div className="shell">
        <main className="shell-main">
          <Outlet />
        </main>

        <nav className="tabbar" aria-label="Secciones">
          {tabs.slice(0, 2).map((t) => (
            <Tab key={t.to} {...t} />
          ))}
          <button type="button" className="tabbar-add" onClick={() => setTarget({ mode: 'new' })} aria-label="Registrar una comida">
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </button>
          {tabs.slice(2).map((t) => (
            <Tab key={t.to} {...t} />
          ))}
        </nav>

        <MealSheet target={target} onClose={() => setTarget(null)} />
      </div>
    </RegisterContext.Provider>
  );
}

function Tab({ to, label, icon: Icon, end }: (typeof tabs)[number]) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `tab${isActive ? ' is-active' : ''}`}>
      <Icon />
      <span>{label}</span>
    </NavLink>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}
function IconWeek() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" strokeLinecap="round" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" />
    </svg>
  );
}
function IconMe() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5 19.5c1.3-3.2 4-4.8 7-4.8s5.7 1.6 7 4.8" strokeLinecap="round" />
    </svg>
  );
}
