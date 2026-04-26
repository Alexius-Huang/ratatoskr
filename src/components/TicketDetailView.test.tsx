// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TicketDetail } from '../../server/types';
import { renderWithProviders } from '../test/renderWithProviders';
import { TicketDetailView } from './TicketDetailView';

vi.mock('./EditTicketModal', () => ({ EditTicketModal: () => null }));
vi.mock('./MarkdownBody', () => ({ MarkdownBody: () => null }));
vi.mock('../lib/openExternal', () => ({ openExternal: vi.fn() }));

function buildTicket(overrides: Partial<TicketDetail> = {}): TicketDetail {
  return {
    number: 1,
    displayId: 'RAT-1',
    type: 'Task',
    title: 'Test ticket',
    state: 'IN_REVIEW',
    body: '',
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    blocks: [],
    blockedBy: [],
    ...overrides,
  };
}

const defaultProps = {
  archiveError: null,
  showEdit: false,
  onCloseEdit: vi.fn(),
  projectName: 'ratatoskr',
  epicLabel: null,
};

describe('TicketDetailView — AI Reviewed badge', () => {
  it.each([
    { isReviewed: true as const,      visible: true,  label: 'true' },
    { isReviewed: false as const,     visible: false, label: 'false' },
    { isReviewed: undefined,          visible: false, label: 'undefined' },
  ])('isReviewed=$label → badge visible=$visible', ({ isReviewed, visible }) => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={buildTicket({ isReviewed, branch: 'feat/x' })}
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
        data={buildTicket({ isReviewed: true })}
      />,
    );
    expect(screen.getByText('AI Reviewed')).toBeInTheDocument();
  });
});
