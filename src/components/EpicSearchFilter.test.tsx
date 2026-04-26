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
    blocks: [],
    blockedBy: [],
  };
}

const epic1 = makeEpic(10, 'Epic one');
const epic2 = makeEpic(11, 'Epic two');
const epics = [epic1, epic2];

describe('EpicSearchFilter', () => {
  it('should render only the search input when no epic is active', () => {
    render(<EpicSearchFilter epics={epics} activeEpicNumber={null} onEpicChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: /filter by epic/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear epic filter/i })).not.toBeInTheDocument();
  });

  it('should show a dropdown with top-5 epics when the input is focused without typing', async () => {
    const user = userEvent.setup();
    const manyEpics = Array.from({ length: 8 }, (_, i) => makeEpic(i + 1, `Epic ${i + 1}`));
    render(<EpicSearchFilter epics={manyEpics} activeEpicNumber={null} onEpicChange={vi.fn()} />);
    await user.click(screen.getByRole('textbox'));
    const items = screen.getAllByRole('button');
    expect(items.length).toBe(5);
  });

  it('should show matching epics in the dropdown as the user types', async () => {
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
    expect(screen.queryByRole('button', { name: /Epic one/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Epic two/i })).not.toBeInTheDocument();
  });

  it('should call onEpicChange with the epic number when a dropdown item is clicked', async () => {
    const user = userEvent.setup();
    const onEpicChange = vi.fn();
    render(<EpicSearchFilter epics={epics} activeEpicNumber={null} onEpicChange={onEpicChange} />);
    await user.type(screen.getByRole('textbox'), 'one');
    await user.click(screen.getByRole('button', { name: /Epic one/i }));
    expect(onEpicChange).toHaveBeenCalledWith(epic1.number);
  });

  it('should display the active epic as an inline tag next to the input', () => {
    render(<EpicSearchFilter epics={epics} activeEpicNumber={epic1.number} onEpicChange={vi.fn()} />);
    expect(screen.getByText(/Epic one/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear epic filter/i })).toBeInTheDocument();
  });

  it('should call onEpicChange with null when the X button on the active tag is clicked', async () => {
    const user = userEvent.setup();
    const onEpicChange = vi.fn();
    render(<EpicSearchFilter epics={epics} activeEpicNumber={epic1.number} onEpicChange={onEpicChange} />);
    await user.click(screen.getByRole('button', { name: /clear epic filter/i }));
    expect(onEpicChange).toHaveBeenCalledWith(null);
  });

  it('should cap the dropdown results to 10 when many epics match', async () => {
    const user = userEvent.setup();
    const manyEpics = Array.from({ length: 15 }, (_, i) =>
      makeEpic(i + 1, `Alpha epic ${i + 1}`),
    );
    render(<EpicSearchFilter epics={manyEpics} activeEpicNumber={null} onEpicChange={vi.fn()} />);
    await user.type(screen.getByRole('textbox'), 'alpha');
    const items = screen.getAllByRole('button');
    expect(items.length).toBe(10);
  });

  it('should apply inline color style to the active chip when the epic has a color', () => {
    const coloredEpic = { ...epic1, color: '#A3BE8C' };
    render(
      <EpicSearchFilter
        epics={[coloredEpic, epic2]}
        activeEpicNumber={coloredEpic.number}
        onEpicChange={vi.fn()}
      />,
    );
    // The chip container div should have inline bg and text color
    const chip = screen.getByText(/Epic one/i).closest('div') as HTMLElement;
    expect(chip).toHaveStyle({ color: '#A3BE8C' });
  });
});
