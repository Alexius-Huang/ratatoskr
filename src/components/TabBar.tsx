import { NavLink, useParams } from 'react-router-dom';
import { TABS } from '../lib/tabs';

export function TabBar() {
  const { name } = useParams<{ name: string }>();
  if (!name) return null;

  return (
    <div className="flex border-b border-nord-3 bg-nord-1">
      {TABS.map((tab) => (
        <NavLink
          key={tab.id}
          to={`/projects/${encodeURIComponent(name)}/${tab.id}`}
          className={({ isActive }) =>
            `px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
              isActive
                ? 'text-nord-8 border-nord-8'
                : 'text-nord-4 border-transparent hover:text-nord-6 hover:border-nord-3'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
