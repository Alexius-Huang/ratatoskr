import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex h-dvh w-screen bg-nord-0 text-nord-6">
      <Sidebar />
      <Outlet />
    </div>
  );
}
