// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { SidebarHomeRow } from './SidebarHomeRow';

function renderAt(path: string, collapsed = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<ul><SidebarHomeRow collapsed={collapsed} /></ul>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SidebarHomeRow', () => {
  it('should render a link to /home labelled HOME when expanded', () => {
    renderAt('/projects/foo/tickets');
    const link = screen.getByRole('link', { name: /home/i });
    expect(link).toHaveAttribute('href', '/home');
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });

  it('should hide the HOME label when collapsed but keep the icon', () => {
    renderAt('/projects/foo/tickets', true);
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
  });

  it('should apply the active styling when the route is /home', () => {
    renderAt('/home');
    const link = screen.getByRole('link', { name: /home/i });
    expect(link.className).toContain('bg-nord-10');
    expect(link.className).toContain('font-medium');
  });

  it('should apply the inactive styling when the route is /projects/...', () => {
    renderAt('/projects/foo/tickets');
    const link = screen.getByRole('link', { name: /home/i });
    expect(link.className).not.toContain('bg-nord-10');
    expect(link.className).toContain('hover:bg-nord-2');
  });
});
