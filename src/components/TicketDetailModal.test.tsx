// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { TicketDetailModal } from './TicketDetailModal';

vi.mock('./TicketDetailPanel', () => ({
  TicketDetailPanel: ({ displayId }: { displayId: string }) => (
    <div data-testid="detail-panel">{displayId}</div>
  ),
}));

const baseProps = {
  projectName: 'ratatoskr',
  number: 1,
  displayId: 'RAT-1',
  onClose: vi.fn(),
};

describe('TicketDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the detail panel inside a dialog', () => {
    renderWithProviders(<TicketDetailModal {...baseProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('detail-panel')).toBeInTheDocument();
    expect(screen.getByText('RAT-1')).toBeInTheDocument();
  });

  it('should call onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<TicketDetailModal {...baseProps} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should call onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<TicketDetailModal {...baseProps} onClose={onClose} />);
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should lock body scroll while open and restore on unmount', () => {
    const { unmount } = render(<TicketDetailModal {...baseProps} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
