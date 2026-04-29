// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { Sidebar } from './Sidebar';

vi.mock('../lib/api', () => ({
  useProjects: vi.fn(),
}));

import { useProjects } from '../lib/api';

const mockUseProjects = vi.mocked(useProjects);

const projectFixture = {
  name: 'ratatoskr',
  config: { prefix: 'RAT', defaultAssignee: null },
  hasConfig: true,
  warnings: [],
};

function setupMocks() {
  mockUseProjects.mockReturnValue({
    data: [projectFixture],
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useProjects>);
}

function render() {
  return renderWithProviders(<Sidebar />, { initialEntries: ['/projects/ratatoskr/tickets'] });
}

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
    setupMocks();
  });

  it('should apply width transition classes to the aside', () => {
    const { container } = render();
    const aside = container.querySelector('aside') as HTMLElement;
    expect(aside.classList.contains('transition-[width]')).toBe(true);
    expect(aside.classList.contains('duration-200')).toBe(true);
    expect(aside.classList.contains('ease-in-out')).toBe(true);
    expect(aside.classList.contains('motion-reduce:transition-none')).toBe(true);
    expect(aside.classList.contains('overflow-x-hidden')).toBe(true);
  });

  it('should toggle width when the collapse button is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render();
    const aside = container.querySelector('aside') as HTMLElement;
    expect(aside.style.width).toBe('240px');
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(aside.style.width).toBe('56px');
  });

  it('should restore the expanded width when re-opened', async () => {
    const user = userEvent.setup();
    const { container } = render();
    const aside = container.querySelector('aside') as HTMLElement;
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(aside.style.width).toBe('56px');
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(aside.style.width).toBe('240px');
  });

  it('should persist the collapsed flag to localStorage', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(localStorage.getItem('ratatoskr:sidebar-collapsed')).toBe('true');
  });

  it('should render the HOME row above the project list', () => {
    render();
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/home');
    expect(links[1]).toHaveAttribute('href', '/projects/ratatoskr/tickets');
  });
});
