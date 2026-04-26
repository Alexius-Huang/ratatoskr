// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { makeEpicSummary } from '../test/factories';
import { EpicCombobox } from './EpicCombobox';

const epic1 = makeEpicSummary({ number: 10, title: 'Project Foundation' });
const epic2 = makeEpicSummary({ number: 11, title: 'UI Improvements' });
const epic3 = makeEpicSummary({ number: 12, title: 'Completed work', state: 'DONE' });
const epics = [epic1, epic2, epic3];

describe('EpicCombobox', () => {
  it('renders input with placeholder and empty value when value is null', () => {
    render(<EpicCombobox epics={epics} value={null} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox');
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe('');
    expect(input).toHaveAttribute('placeholder', '(no epic)');
  });

  it('shows selected epic display string when closed and value is set', () => {
    render(<EpicCombobox epics={epics} value={10} onChange={vi.fn()} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('RAT-10 — Project Foundation');
  });

  it('opens dropdown on focus and lists (no epic) and all epics', async () => {
    const user = userEvent.setup();
    render(<EpicCombobox epics={[epic1, epic2]} value={null} onChange={vi.fn()} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByText('(no epic)')).toBeInTheDocument();
    expect(screen.getByText(/Project Foundation/)).toBeInTheDocument();
    expect(screen.getByText(/UI Improvements/)).toBeInTheDocument();
  });

  it('filters by displayId partial match', async () => {
    const user = userEvent.setup();
    render(<EpicCombobox epics={[epic1, epic2]} value={null} onChange={vi.fn()} />);
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), 'RAT-10');
    expect(screen.getByText(/Project Foundation/)).toBeInTheDocument();
    expect(screen.queryByText(/UI Improvements/)).not.toBeInTheDocument();
  });

  it('filters by title partial match', async () => {
    const user = userEvent.setup();
    render(<EpicCombobox epics={[epic1, epic2]} value={null} onChange={vi.fn()} />);
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), 'UI');
    expect(screen.getByText(/UI Improvements/)).toBeInTheDocument();
    expect(screen.queryByText(/Project Foundation/)).not.toBeInTheDocument();
  });

  it('filters case-insensitively', async () => {
    const user = userEvent.setup();
    render(<EpicCombobox epics={[epic1, epic2]} value={null} onChange={vi.fn()} />);
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), 'project foundation');
    expect(screen.getByText(/Project Foundation/)).toBeInTheDocument();
    expect(screen.queryByText(/UI Improvements/)).not.toBeInTheDocument();
  });

  it('shows all epics when query is empty', async () => {
    const user = userEvent.setup();
    render(<EpicCombobox epics={[epic1, epic2]} value={null} onChange={vi.fn()} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByText(/Project Foundation/)).toBeInTheDocument();
    expect(screen.getByText(/UI Improvements/)).toBeInTheDocument();
  });

  it('calls onChange with epic number and closes dropdown when an epic is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EpicCombobox epics={[epic1, epic2]} value={null} onChange={onChange} />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText(/Project Foundation/));
    expect(onChange).toHaveBeenCalledWith(epic1.number);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('calls onChange with null when (no epic) is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EpicCombobox epics={[epic1]} value={10} onChange={onChange} />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('(no epic)'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('navigates with ArrowDown and selects with Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EpicCombobox epics={[epic1, epic2]} value={null} onChange={onChange} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    // ArrowDown from -1 → 0 is "(no epic)" (non-DONE, selectable)
    await user.keyboard('{ArrowDown}');
    // ArrowDown again → 1 is epic1
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(epic1.number);
  });

  it('closes without calling onChange on Escape', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EpicCombobox epics={[epic1]} value={null} onChange={onChange} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders DONE epics with aria-disabled and does not call onChange when clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EpicCombobox epics={[epic1, epic3]} value={null} onChange={onChange} />);
    await user.click(screen.getByRole('combobox'));
    const doneOption = screen.getByRole('option', { name: /Completed work/ });
    expect(doneOption).toHaveAttribute('aria-disabled', 'true');
    await user.click(doneOption);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows "No matching epics" when query matches nothing', async () => {
    const user = userEvent.setup();
    render(<EpicCombobox epics={[epic1, epic2]} value={null} onChange={vi.fn()} />);
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), 'zzz-no-match');
    expect(screen.getByText('No matching epics')).toBeInTheDocument();
    expect(screen.getByText('(no epic)')).toBeInTheDocument();
  });
});
