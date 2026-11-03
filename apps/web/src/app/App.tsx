import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Layout } from './Layout';
import { HomeScreen } from '../features/home/HomeScreen';
import { LoginScreen } from '../features/auth/LoginScreen';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { HistoryScreen } from '../features/history/HistoryScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { AdminScreen } from '../features/admin/AdminScreen';
import { RecipesScreen } from '../features/recipes/RecipesScreen';
import { Cachete } from '../mascot/Cachete';

export function App() {
  const status = useStore((s) => s.status);
  const bootError = useStore((s) => s.bootError);
  const boot = useStore((s) => s.boot);
  const hasProfile = useStore((s) => !!s.profile);
  const isAdmin = useStore((s) => s.user?.role === 'admin');

  useEffect(() => {
    void boot();
  }, [boot]);

  if (status === 'loading') {
    return (
      <div className="splash">
        <Cachete expression="descanso" size={130} />
        <p>Un segundito…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="splash">
        <Cachete expression="acompañamiento" size={130} />
        <p>{bootError ?? 'No pudimos conectarnos.'}</p>
        <button type="button" className="btn-primary" onClick={() => void boot()}>
          Probar de nuevo
        </button>
      </div>
    );
  }

  if (status === 'anon') return <LoginScreen />;

  return (
    <BrowserRouter>
      <Routes>
        {/* El admin puede entrar al panel aunque todavía no haya armado su propio perfil */}
        {isAdmin && <Route path="admin" element={<AdminScreen />} />}
        {!hasProfile ? (
          <Route path="*" element={<OnboardingScreen />} />
        ) : (
          <Route element={<Layout />}>
            <Route index element={<HomeScreen />} />
            <Route path="recetas" element={<RecipesScreen />} />
            <Route path="semana" element={<Navigate to="/recetas" replace />} />
            <Route path="historial" element={<HistoryScreen />} />
            <Route path="yo" element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}
