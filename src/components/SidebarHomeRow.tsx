import { Link, useLocation } from 'react-router-dom';
import { Home } from 'lucide-react';

interface Props { collapsed: boolean }

export function SidebarHomeRow({ collapsed }: Props) {
  const { pathname } = useLocation();
  const isActive = pathname === '/home' || pathname.startsWith('/home/');

  const base = 'flex items-center gap-2 py-2 transition-colors cursor-pointer';
  const activeClass = 'bg-nord-10 text-nord-6 font-medium';
  const inactiveClass = 'text-nord-5 hover:bg-nord-2';
  const tileSize = collapsed ? 36 : 28;

  return (
    <li>
      <Link
        to="/home"
        title={collapsed ? 'Home' : undefined}
        className={`${base} ${isActive ? activeClass : inactiveClass} ${collapsed ? 'justify-center px-0' : 'px-3'}`}
      >
        <div
          className="rounded flex items-center justify-center shrink-0 bg-nord-9 text-nord-0"
          style={{ width: tileSize, height: tileSize }}
        >
          <Home size={collapsed ? 18 : 14} aria-hidden="true" />
        </div>
        {!collapsed && <span className="flex-1 truncate text-sm">HOME</span>}
      </Link>
    </li>
  );
}
