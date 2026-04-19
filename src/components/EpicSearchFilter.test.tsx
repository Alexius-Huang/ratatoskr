// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { TicketSummary } from '../../server/types';
import { EpicSearchFilter } from './EpicSearchFilter';

function makeEpic(number: number, title: string): TicketSummary {
  return {
    number,
    displayId: `RAT-${number}`,
    type: 'Epic',
    title,
    state: 'IN_PROGRESS',
    created: '',
    updated: '',
  };
}

const epic1 = makeEpic(10, 'Epic one');
const epic2 = makeEpic(11, 'Epic two');
const epics = [epic1, epic2];

describe('EpicSearchFilter', () => {
  it('should render only the search input when no query is typed and no epic is active', () => {
    render(<EpicSearchFilter epics={epics} activeEpicNumber={null} onEpicChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: /filter by epic/i })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should show matching epic chips after the user types a query', async () => {
    const user = userEvent.setup();
    render(<EpicSearchFilter epics={epics} activeEpicNumber={null} onEpicChange={vi.fn()} />);
    await user.type(screen.getByRole('textbox'), 'two');
    expect(screen.getByRole('button', { name: /Epic two/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Epic one/i })).not.toBeInTheDocument();
  });

  it('should match case-insensitively on title', async () => {
    const user = userEvent.setup();
    render(<EpicSearchFilter epics={epics} activeEpicNumber={null} onEpicChange={vi.fn()} />);
    await user.type(screen.getByRole('textbox'), 'ONE');
    expect(screen.getByRole('button', { name: /Epic one/i })).toBeInTheDocument();
  });

  it('should not match against the epic displayId', async () => {
    const user = userEvent.setup();
    render(<EpicSearchFilter epics={epics} activeEpicNumber={null} onEpicChange={vi.fn()} />);
    await user.type(screen.getByRole('textbox'), 'RAT-10');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should call onEpicChange with the epic number when an unselected chip is clicked', async () => {
    const user = userEvent.setup();
    const onEpicChange = vi.fn();
    render(<EpicSearchFilter epics={epics} activeEpicNumber={null} onEpicChange={onEpicChange} />);
    await user.type(screen.getByRole('textbox'), 'one');
    await user.click(screen.getByRole('button', { name: /Epic one/i }));
    expect(onEpicChange).toHaveBeenCalledWith(epic1.number);
  });

  it('should call onEpicChange with null when the currently-active chip is clicked (toggle off)', async () => {
    const user = userEvent.setup();
    const onEpicChange = vi.fn();
    render(<EpicSearchFilter epics={epics} activeEpicNumber={epic1.number} onEpicChange={onEpicChange} />);
    // active chip is visible even with no query (pinned)
    await user.click(screen.getByRole('button', { name: /Epic one/i }));
    expect(onEpicChange).toHaveBeenCalledWith(null);
  });

  it('should show the active epic chip even when the query does not match its title', async () => {
    const user = userEvent.setup();
    render(<EpicSearchFilter epics={epics} activeEpicNumber={epic1.number} onEpicChange={vi.fn()} />);
    await user.type(screen.getByRole('textbox'), 'two');
    // epic1 (active) still shows pinned even though "two" doesn't match "Epic one"
    expect(screen.getByRole('button', { name: /Epic one/i })).toBeInTheDocument();
    // epic2 also shows (matches query)
    expect(screen.getByRole('button', { name: /Epic two/i })).toBeInTheDocument();
  });

  it('should cap the visible match count at 10', async () => {
    const user = userEvent.setup();
    const manyEpics = Array.from({ length: 15 }, (_, i) =>
      makeEpic(i + 1, `Alpha epic ${i + 1}`),
    );
    render(<EpicSearchFilter epics={manyEpics} activeEpicNumber={null} onEpicChange={vi.fn()} />);
    await user.type(screen.getByRole('textbox'), 'alpha');
    const chips = screen.getAllByRole('button');
    expect(chips.length).toBe(10);
  });
});
