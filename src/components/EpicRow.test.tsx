// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TicketSummary } from '../../server/types';
import { EpicRow } from './EpicRow';

function makeEpic(overrides: Partial<TicketSummary> = {}): TicketSummary {
  return {
    number: 1,
    displayId: 'RAT-1',
    type: 'Epic',
    title: 'Ratatoskr Project Foundation',
    state: 'IN_PROGRESS',
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function noop() {}

describe('EpicRow', () => {
  it('should render the epic display ID and title', () => {
    render(<EpicRow ticket={makeEpic()} isSelected={false} onClick={noop} />);
    expect(screen.getByText('RAT-1')).toBeDefined();
    expect(screen.getByText('Ratatoskr Project Foundation')).toBeDefined();
  });

  it('should show "No child tasks yet." when total is 0', () => {
    render(<EpicRow ticket={makeEpic()} isSelected={false} onClick={noop} />);
    expect(screen.getByText('No child tasks yet.')).toBeDefined();
  });

  it('should not render a progress bar when total is 0', () => {
    const { container } = render(
      <EpicRow ticket={makeEpic()} isSelected={false} onClick={noop} />,
    );
    const bars = container.querySelectorAll('[style*="width"]');
    expect(bars.length).toBe(0);
  });

  it('should render a progress bar when counts.total > 0', () => {
    const ticket = makeEpic({
      childCounts: {
        total: 4,
        byState: { NOT_READY: 0, PLANNING: 0, READY: 1, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 3, WONT_DO: 0 },
      },
    });
    const { container } = render(
      <EpicRow ticket={ticket} isSelected={false} onClick={noop} />,
    );
    const bar = container.querySelector('[style*="width"]');
    expect(bar).not.toBeNull();
  });

  it('should set bar fill width to the percentage of DONE tickets', () => {
    const ticket = makeEpic({
      childCounts: {
        total: 5,
        byState: { NOT_READY: 0, PLANNING: 0, READY: 1, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 4, WONT_DO: 0 },
      },
    });
    const { container } = render(
      <EpicRow ticket={ticket} isSelected={false} onClick={noop} />,
    );
    const fill = container.querySelector('[style*="width"]') as HTMLElement;
    expect(fill.style.width).toBe('80%');
  });

  it('should show non-zero state badges and hide zero-count states', () => {
    const ticket = makeEpic({
      childCounts: {
        total: 3,
        byState: { NOT_READY: 2, PLANNING: 0, READY: 1, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0, WONT_DO: 0 },
      },
    });
    render(<EpicRow ticket={ticket} isSelected={false} onClick={noop} />);
    expect(screen.getByText(/2 NOT READY/i)).toBeDefined();
    expect(screen.getByText(/1 READY/i)).toBeDefined();
    expect(screen.queryByText(/PLANNING/i)).toBeNull();
    expect(screen.queryByText(/IN_PROGRESS/i)).toBeNull();
  });

  it('should reflect 100% completion when all tickets are DONE', () => {
    const ticket = makeEpic({
      childCounts: {
        total: 3,
        byState: { NOT_READY: 0, PLANNING: 0, READY: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 3, WONT_DO: 0 },
      },
    });
    const { container } = render(
      <EpicRow ticket={ticket} isSelected={false} onClick={noop} />,
    );
    const fill = container.querySelector('[style*="width"]') as HTMLElement;
    expect(fill.style.width).toBe('100%');
    expect(screen.getByText(/3\/3/)).toBeDefined();
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('should render the color swatch button when onColorChange is provided', () => {
    render(
      <EpicRow ticket={makeEpic({ color: '#A3BE8C' })} isSelected={false} onClick={noop} onColorChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /epic color/i })).toBeDefined();
  });

  it('should forward swatch selection to onColorChange', async () => {
    const user = userEvent.setup();
    const onColorChange = vi.fn();
    render(
      <EpicRow ticket={makeEpic()} isSelected={false} onClick={noop} onColorChange={onColorChange} />,
    );
    const swatch = screen.getByRole('button', { name: /epic color|set epic/i });
    await user.click(swatch);
    await user.click(screen.getByLabelText('#BF616A'));
    expect(onColorChange).toHaveBeenCalledWith('#BF616A');
  });

  it('should not invoke row onClick when the swatch is clicked', async () => {
    const user = userEvent.setup();
    const rowClick = vi.fn();
    render(
      <EpicRow ticket={makeEpic()} isSelected={false} onClick={rowClick} onColorChange={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: /epic color|set epic/i }));
    expect(rowClick).not.toHaveBeenCalled();
  });
});

describe('EpicRow — Mark-Done button', () => {
  const doneChildCounts = {
    total: 2,
    byState: { NOT_READY: 0, PLANNING: 0, READY: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 2, WONT_DO: 0 },
  };
  const partialChildCounts = {
    total: 2,
    byState: { NOT_READY: 0, PLANNING: 0, READY: 0, IN_PROGRESS: 1, IN_REVIEW: 0, DONE: 1, WONT_DO: 0 },
  };

  it('should render the Mark-Done button when IN_PROGRESS and all children DONE', () => {
    render(
      <EpicRow
        ticket={makeEpic({ state: 'IN_PROGRESS', childCounts: doneChildCounts })}
        isSelected={false}
        onClick={noop}
        onMarkDone={vi.fn()}
      />,
    );
    const btns = screen.getAllByRole('button', { name: /mark epic as done/i });
    // The outer div[role=button] and inner <button> both match; we want the <button> element
    expect(btns.some((el) => el.tagName === 'BUTTON')).toBe(true);
  });

  it('should not render the Mark-Done button when epic has any non-DONE child', () => {
    render(
      <EpicRow
        ticket={makeEpic({ state: 'IN_PROGRESS', childCounts: partialChildCounts })}
        isSelected={false}
        onClick={noop}
        onMarkDone={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /mark epic as done/i })).toBeNull();
  });

  it('should not render the Mark-Done button when epic is DONE', () => {
    render(
      <EpicRow
        ticket={makeEpic({ state: 'DONE', childCounts: doneChildCounts })}
        isSelected={false}
        onClick={noop}
        onMarkDone={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /mark epic as done/i })).toBeNull();
  });

  it('should not render the Mark-Done button when onMarkDone prop is absent', () => {
    render(
      <EpicRow
        ticket={makeEpic({ state: 'IN_PROGRESS', childCounts: doneChildCounts })}
        isSelected={false}
        onClick={noop}
      />,
    );
    expect(screen.queryByRole('button', { name: /mark epic as done/i })).toBeNull();
  });

  it('should call onMarkDone and not onClick when the Mark-Done button is clicked', async () => {
    const user = userEvent.setup();
    const onMarkDone = vi.fn();
    const onClick = vi.fn();
    render(
      <EpicRow
        ticket={makeEpic({ state: 'IN_PROGRESS', childCounts: doneChildCounts })}
        isSelected={false}
        onClick={onClick}
        onMarkDone={onMarkDone}
      />,
    );
    const btns = screen.getAllByRole('button', { name: /mark epic as done/i });
    const markDoneBtn = btns.find((el) => el.tagName === 'BUTTON')!;
    await user.click(markDoneBtn);
    expect(onMarkDone).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('should render Mark-Done when all children are a mix of DONE and WONT_DO', () => {
    const mixedCounts = {
      total: 3,
      byState: { NOT_READY: 0, PLANNING: 0, READY: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 2, WONT_DO: 1 },
    };
    render(
      <EpicRow
        ticket={makeEpic({ state: 'IN_PROGRESS', childCounts: mixedCounts })}
        isSelected={false}
        onClick={noop}
        onMarkDone={vi.fn()}
      />,
    );
    const btns = screen.getAllByRole('button', { name: /mark epic as done/i });
    expect(btns.some((el) => el.tagName === 'BUTTON')).toBe(true);
  });
});

describe('EpicRow — WONT_DO progress', () => {
  it('counts WONT_DO as completed in progress percentage', () => {
    const ticket = makeEpic({
      childCounts: {
        total: 3,
        byState: { NOT_READY: 0, PLANNING: 0, READY: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 2, WONT_DO: 1 },
      },
    });
    const { container } = render(<EpicRow ticket={ticket} isSelected={false} onClick={noop} />);
    const fill = container.querySelector('[style*="width"]') as HTMLElement;
    expect(fill.style.width).toBe('100%');
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('renders a WONT DO state chip', () => {
    const ticket = makeEpic({
      childCounts: {
        total: 2,
        byState: { NOT_READY: 0, PLANNING: 0, READY: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 1, WONT_DO: 1 },
      },
    });
    render(<EpicRow ticket={ticket} isSelected={false} onClick={noop} />);
    expect(screen.getByText(/1 WONT DO/i)).toBeDefined();
  });
});
