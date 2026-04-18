import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { EmptyState } from './components/EmptyState';
import { MainPane } from './components/MainPane';

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<EmptyState />} />
        <Route
          path="projects/:name"
          element={<Navigate to="tickets" replace />}
        />
        <Route path="projects/:name/:tab" element={<MainPane />} />
      </Route>
    </Routes>
  );
}

export default App;
