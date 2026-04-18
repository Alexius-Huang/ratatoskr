import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useProjects } from '../lib/api';
import { SidebarRow } from './SidebarRow';

const STORAGE_COLLAPSED = 'ratatoskr:sidebar-collapsed';
const STORAGE_WIDTH = 'ratatoskr:sidebar-width';
const MIN_WIDTH = 160;
const MAX_WIDTH = 360;
const DEFAULT_WIDTH = 240;
const COLLAPSED_WIDTH = 56;

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_COLLAPSED) === 'true';
  } catch {
    return false;
  }
}

function readWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_WIDTH);
    if (raw === null) return DEFAULT_WIDTH;
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < MIN_WIDTH || n > MAX_WIDTH) return DEFAULT_WIDTH;
    return n;
  } catch {
    return DEFAULT_WIDTH;
  }
}

export function Sidebar() {
  const { data: projects, isLoading, error } = useProjects();
  const { name: selectedProject } = useParams<{ name: string }>();

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [expandedWidth, setExpandedWidth] = useState(readWidth);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COLLAPSED, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_WIDTH, String(expandedWidth));
    } catch {
      // ignore
    }
  }, [expandedWidth]);

  const rafRef = useRef<number | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartWidthRef = useRef<number>(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragStartXRef.current = e.clientX;
      dragStartWidthRef.current = expandedWidth;
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
    },
    [expandedWidth],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!(e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId)) return;
    const delta = e.clientX - dragStartXRef.current;
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidthRef.current + delta));
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setExpandedWidth(next);
      rafRef.current = null;
    });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    setIsDragging(false);
  }, []);

  const width = collapsed ? COLLAPSED_WIDTH : expandedWidth;

  return (
    <aside
      className="shrink-0 border-r border-nord-3 bg-nord-1 h-screen overflow-y-auto overflow-x-hidden flex flex-col relative transition-[width] duration-200 ease-in-out motion-reduce:transition-none motion-reduce:duration-0"
      style={{ width, transition: isDragging ? 'none' : undefined }}
    >
      {/* Header */}
      <div
        className={`border-b border-nord-3 flex items-center ${
          collapsed ? 'justify-center py-3 px-0' : 'px-3 py-3 gap-2'
        }`}
      >
        {!collapsed && (
          <span className="flex-1 text-xs font-semibold text-nord-4 uppercase tracking-widest select-none">
            Ratatoskr
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-nord-4 hover:text-nord-6 transition-colors p-0.5 rounded"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </button>
      </div>

      {/* Project list */}
      {isLoading && (
        <p className={`py-3 text-sm text-nord-4 ${collapsed ? 'px-0 text-center' : 'px-4'}`}>
          {collapsed ? '…' : 'Loading…'}
        </p>
      )}

      {error && (
        <p className={`py-3 text-sm text-nord-11 ${collapsed ? 'px-0 text-center' : 'px-4'}`}>
          {collapsed ? '!' : `Failed to load projects: ${String(error)}`}
        </p>
      )}

      {projects && projects.length === 0 && !collapsed && (
        <p className="px-4 py-3 text-sm text-nord-4">No projects detected.</p>
      )}

      <ul className="flex-1">
        {projects?.map((p) => (
          <SidebarRow
            key={p.name}
            project={p}
            isActive={p.name === selectedProject}
            collapsed={collapsed}
          />
        ))}
      </ul>

      {/* Draggable divider — only in expanded mode */}
      {!collapsed && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-nord-9 transition-colors"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      )}
    </aside>
  );
}
