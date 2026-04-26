// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeTicketDetail } from '../test/factories';
import { renderWithProviders } from '../test/renderWithProviders';
import { TicketDetailView } from './TicketDetailView';

vi.mock('./EditTicketModal', () => ({ EditTicketModal: () => null }));
vi.mock('./MarkdownBody', () => ({ MarkdownBody: () => null }));
vi.mock('../lib/openExternal', () => ({ openExternal: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

const defaultProps = {
  archiveError: null,
  showEdit: false,
  onCloseEdit: vi.fn(),
  projectName: 'ratatoskr',
  epicLabel: null,
};

describe('TicketDetailView — dependency section', () => {
  it('should render the dependency section when blockedBy is non-empty', () => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail({ blockedBy: ['RAT-5'] })}
      />,
    );
    expect(screen.getByText('Blocked by:')).toBeInTheDocument();
  });

  it('should render the dependency section when blocks is non-empty', () => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail({ blocks: ['RAT-12'] })}
      />,
    );
    expect(screen.getByText('Blocks:')).toBeInTheDocument();
  });

  it('should not render the dependency section when both arrays are empty', () => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail()}
      />,
    );
    expect(screen.queryByText('Blocked by:')).not.toBeInTheDocument();
    expect(screen.queryByText('Blocks:')).not.toBeInTheDocument();
  });
});

describe('TicketDetailView — AI Reviewed badge', () => {
  it.each([
    { isReviewed: true as const,      visible: true,  label: 'true' },
    { isReviewed: false as const,     visible: false, label: 'false' },
    { isReviewed: undefined,          visible: false, label: 'undefined' },
  ])('isReviewed=$label → badge visible=$visible', ({ isReviewed, visible }) => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail({ isReviewed, branch: 'feat/x' })}
      />,
    );
    const badge = screen.queryByText('AI Reviewed');
    if (visible) expect(badge).toBeInTheDocument();
    else expect(badge).not.toBeInTheDocument();
  });

  it('renders badge when isReviewed=true even without branch or PR', () => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail({ isReviewed: true })}
      />,
    );
    expect(screen.getByText('AI Reviewed')).toBeInTheDocument();
  });
});
