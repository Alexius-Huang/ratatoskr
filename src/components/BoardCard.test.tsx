// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeTicketSummary } from '../test/factories';
import { renderWithProviders } from '../test/renderWithProviders';
import { BoardCard } from './BoardCard';

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  draggable: () => () => {},
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('BoardCard — click handler', () => {
  it('should call onClick when the card is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProviders(<BoardCard ticket={makeTicketSummary()} onClick={onClick} />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should render without onClick prop', () => {
    renderWithProviders(<BoardCard ticket={makeTicketSummary()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

describe('BoardCard — epic tag navigation', () => {
  it('clicking the epic tag navigates to epics tab without invoking card onClick', async () => {
    const user = userEvent.setup();
    const cardClick = vi.fn();
    mockNavigate.mockReset();
    const ticket = makeTicketSummary({ epic: 10, epicTitle: 'My Epic', epicColor: '#A3BE8C' });
    const { container } = renderWithProviders(<BoardCard ticket={ticket} onClick={cardClick} />);
    const epicTag = container.querySelector('[title="My Epic"]') as HTMLElement;
    await user.click(epicTag);
    expect(mockNavigate).toHaveBeenCalledWith('/projects/ratatoskr/epics?inspect=10');
    expect(cardClick).not.toHaveBeenCalled();
  });
});

describe('BoardCard — epic tag color', () => {
  it('should not render an epic tag when ticket has no epic', () => {
    const { container } = renderWithProviders(<BoardCard ticket={makeTicketSummary()} />);
    // No epic tag button should be present
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('should render a colored epic tag using the explicit epicColor', () => {
    const ticket = makeTicketSummary({ epic: 1, epicTitle: 'My Epic', epicColor: '#A3BE8C' });
    const { container } = renderWithProviders(<BoardCard ticket={ticket} />);
    const tag = container.querySelector('[title="My Epic"]') as HTMLElement;
    expect(tag).not.toBeNull();
    expect(tag).toHaveStyle({ color: '#A3BE8C' });
  });

  it('should fall back to defaultEpicColor when epicColor is absent', () => {
    const ticket = makeTicketSummary({ epic: 3, epicTitle: 'Fallback Epic' });
    const { container } = renderWithProviders(<BoardCard ticket={ticket} />);
    const tag = container.querySelector('[title="Fallback Epic"]') as HTMLElement;
    expect(tag).not.toBeNull();
    // Tag should have some non-empty color — it uses the deterministic default
    expect(tag.style.color).not.toBe('');
    expect(tag.style.backgroundColor).not.toBe('');
  });
});
