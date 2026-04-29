import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { EmptyState } from './components/EmptyState';
import { HomePane } from './components/HomePane';
import { MainPane } from './components/MainPane';
import { NotFound } from './components/NotFound';
import { SetupScreen } from './components/SetupScreen';
import { useAppConfig } from './lib/api';

function App() {
  const { data: config, isLoading } = useAppConfig();

  if (isLoading) return null;

  if (!config?.configured) {
    return (
      <Routes>
        <Route path="*" element={<SetupScreen />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="setup" element={<Navigate to="/" replace />} />
        <Route index element={<EmptyState />} />
        <Route path="home" element={<HomePane />} />
        <Route
          path="projects/:name"
          element={<Navigate to="tickets" replace />}
        />
        <Route path="projects/:name/:tab" element={<MainPane />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
