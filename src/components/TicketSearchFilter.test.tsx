// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { TicketSearchFilter } from './TicketSearchFilter';

describe('TicketSearchFilter', () => {
  it('should render with the provided query value', () => {
    renderWithProviders(<TicketSearchFilter query="RAT-1" onQueryChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: /filter by title or id/i })).toHaveValue('RAT-1');
  });

  it('should call onQueryChange when the user types', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    renderWithProviders(<TicketSearchFilter query="" onQueryChange={onQueryChange} />);
    await user.type(screen.getByRole('textbox', { name: /filter by title or id/i }), 'foo');
    expect(onQueryChange).toHaveBeenCalled();
  });

  it('should not render a clear button when the query is empty', () => {
    renderWithProviders(<TicketSearchFilter query="" onQueryChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /clear title or id filter/i })).not.toBeInTheDocument();
  });

  it('should render a clear button when the query is non-empty', () => {
    renderWithProviders(<TicketSearchFilter query="hello" onQueryChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /clear title or id filter/i })).toBeInTheDocument();
  });

  it('should call onQueryChange with an empty string when the clear button is clicked', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    renderWithProviders(<TicketSearchFilter query="hello" onQueryChange={onQueryChange} />);
    await user.click(screen.getByRole('button', { name: /clear title or id filter/i }));
    expect(onQueryChange).toHaveBeenCalledWith('');
  });
});
