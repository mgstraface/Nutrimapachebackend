import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Layout } from './Layout';
import { HomeScreen } from '../features/home/HomeScreen';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { HistoryScreen } from '../features/history/HistoryScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { Placeholder } from '../components/Placeholder';

export function App() {
  const hasProfile = useStore((s) => !!s.profile);

  return (
    <BrowserRouter>
      <Routes>
        {!hasProfile ? (
          <Route path="*" element={<OnboardingScreen />} />
        ) : (
          <Route element={<Layout />}>
            <Route index element={<HomeScreen />} />
            <Route path="semana" element={<Placeholder title="Tu semana" text="Acá vas a armar el menú semanal y guardar recetas favoritas." />} />
            <Route path="historial" element={<HistoryScreen />} />
            <Route path="yo" element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}
