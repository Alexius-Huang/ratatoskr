// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { EpicTag } from './EpicTag';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('EpicTag', () => {
  beforeEach(() => mockNavigate.mockReset());

  it('renders the label', () => {
    renderWithProviders(<EpicTag projectName="ratatoskr" epic={10} label="My Epic" />);
    expect(screen.getByRole('button', { name: 'My Epic' })).toBeInTheDocument();
  });

  it('click navigates to the epics inspect URL with the epic number', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EpicTag projectName="ratatoskr" epic={10} label="My Epic" />);
    await user.click(screen.getByRole('button', { name: 'My Epic' }));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/ratatoskr/epics?inspect=10');
  });

  it('click stops propagation so parent onClick is not invoked', async () => {
    const user = userEvent.setup();
    const parentClick = vi.fn();
    renderWithProviders(
      <div onClick={parentClick}>
        <EpicTag projectName="ratatoskr" epic={10} label="My Epic" />
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'My Epic' }));
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('applies extra className when provided', () => {
    renderWithProviders(
      <EpicTag projectName="ratatoskr" epic={10} label="My Epic" className="extra-class" />,
    );
    const btn = screen.getByRole('button', { name: 'My Epic' });
    expect(btn.className).toContain('extra-class');
  });

  it('uses defaultEpicColor styling when color is null', () => {
    renderWithProviders(<EpicTag projectName="ratatoskr" epic={3} label="Fallback" color={null} />);
    const btn = screen.getByRole('button', { name: 'Fallback' });
    expect(btn.style.color).not.toBe('');
    expect(btn.style.backgroundColor).not.toBe('');
  });
});
