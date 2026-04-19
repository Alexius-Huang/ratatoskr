// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TicketSummary } from '../../server/types';
import { BoardCard } from './BoardCard';

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  draggable: () => () => {},
}));

function makeTask(overrides: Partial<TicketSummary> = {}): TicketSummary {
  return {
    number: 1,
    displayId: 'RAT-1',
    type: 'Task',
    title: 'A task',
    state: 'IN_PROGRESS',
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('BoardCard — click handler', () => {
  it('should call onClick when the card is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<BoardCard ticket={makeTask()} onClick={onClick} />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should render without onClick prop', () => {
    render(<BoardCard ticket={makeTask()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

describe('BoardCard — epic tag color', () => {
  it('should not render an epic tag when ticket has no epic', () => {
    const { container } = render(<BoardCard ticket={makeTask()} />);
    const spans = container.querySelectorAll('span');
    const tagSpans = Array.from(spans).filter((s) => s.classList.contains('rounded'));
    // Only the BUG badge is rounded (absent here); no epic tag
    expect(tagSpans.length).toBe(0);
  });

  it('should render a colored epic tag using the explicit epicColor', () => {
    const ticket = makeTask({ epic: 1, epicTitle: 'My Epic', epicColor: '#A3BE8C' });
    const { container } = render(<BoardCard ticket={ticket} />);
    const tag = container.querySelector('[title="My Epic"]') as HTMLElement;
    expect(tag).not.toBeNull();
    expect(tag).toHaveStyle({ color: '#A3BE8C' });
  });

  it('should fall back to defaultEpicColor when epicColor is absent', () => {
    const ticket = makeTask({ epic: 3, epicTitle: 'Fallback Epic' });
    const { container } = render(<BoardCard ticket={ticket} />);
    const tag = container.querySelector('[title="Fallback Epic"]') as HTMLElement;
    expect(tag).not.toBeNull();
    // Tag should have some non-empty color — it uses the deterministic default
    expect(tag.style.color).not.toBe('');
    expect(tag.style.backgroundColor).not.toBe('');
  });
});
