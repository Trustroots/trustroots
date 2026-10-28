import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import SupportStatusImport from '@/modules/admin/client/components/SupportStatusImport';
import http from '@/modules/core/client/api/http-client';

jest.mock('@/modules/core/client/api/http-client', () => ({
  __esModule: true,
  default: { post: jest.fn() },
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}));
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentUser: () => global.window.user,
}));

const post = jest.mocked(http.post);

const manifest = {
  version: 1,
  exportedAt: '2025-01-01T00:00:00.000Z',
  items: [
    {
      zendeskTicketId: 789,
      status: 'pending',
      updatedAt: '2025-01-01T00:00:00.000Z',
      fingerprint: 'a'.repeat(64),
    },
  ],
};

function fileFrom(text: string) {
  const file = new File([text], 'reduced-statuses.json', {
    type: 'application/json',
  });
  Object.defineProperty(file, 'text', { value: async () => text });
  return file;
}

describe('<SupportStatusImport />', () => {
  beforeEach(() => {
    window.user = { roles: ['user', 'admin'] };
    post.mockReset();
  });

  afterEach(() => {
    delete window.user;
  });

  it('keeps the upload and apply control administrator-only', () => {
    window.user = { roles: ['user', 'support-team'] };
    const { container } = render(<SupportStatusImport />);
    expect(container).toBeEmptyDOMElement();
  });

  it('previews a reduced manifest and applies only after review', async () => {
    post
      .mockResolvedValueOnce({
        data: {
          previewId: 'preview-1',
          counts: {
            total: 1,
            eligible: 1,
            alreadyApplied: 0,
            skipped: 0,
            skippedByReason: {},
          },
          changes: [
            {
              requestId: 'request-1',
              zendeskTicketId: 789,
              currentStatus: 'open',
              importedStatus: 'pending',
              matchKind: 'exact',
              reason: 'exact request fingerprint',
              updatedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
          expiresAt: '2025-01-01T00:30:00.000Z',
        },
      } as never)
      .mockResolvedValueOnce({
        data: { applied: 1, alreadyApplied: 0, skipped: 0 },
      } as never);
    render(<SupportStatusImport />);

    fireEvent.change(screen.getByLabelText('Reduced JSON manifest'), {
      target: { files: [fileFrom(JSON.stringify(manifest))] },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview status changes' }),
    );

    expect(
      await screen.findByText(/1 eligible, 0 already applied, 0 skipped/),
    ).toBeVisible();
    expect(screen.getByRole('cell', { name: 'request-1' })).toBeVisible();
    expect(screen.getByRole('cell', { name: '789' })).toBeVisible();
    expect(screen.getByRole('cell', { name: 'open' })).toBeVisible();
    expect(screen.getByRole('cell', { name: 'pending' })).toBeVisible();
    expect(post).toHaveBeenNthCalledWith(
      1,
      '/api/admin/support-import/preview',
      manifest,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Apply status changes' }),
    );
    expect(
      await screen.findByText(/Applied 1; already applied 0; skipped 0/),
    ).toBeVisible();
    await waitFor(() =>
      expect(post).toHaveBeenNthCalledWith(
        2,
        '/api/admin/support-import/apply',
        { previewId: 'preview-1', selectedMatches: [] },
      ),
    );
  });

  it('shows competing reduced candidates and applies only the explicitly selected suggestion', async () => {
    const v2Manifest = {
      version: 2,
      exportedAt: '2025-01-01T00:00:00.000Z',
      items: [
        {
          ...manifest.items[0],
          evidence: {
            senderHash: 'a'.repeat(64),
            category: 'other',
            submittedAt: '2025-01-01T00:00:00.000Z',
            normalisedMessageHash: 'b'.repeat(64),
          },
        },
      ],
    };
    post
      .mockResolvedValueOnce({
        data: {
          previewId: 'suggestion-preview',
          counts: {
            total: 2,
            eligible: 0,
            suggested: 2,
            alreadyApplied: 0,
            skipped: 2,
            skippedByReason: {},
          },
          changes: [],
          matchReviews: [
            {
              zendeskTicketId: 789,
              category: 'other',
              submittedAt: '2025-01-01T00:00:00.000Z',
              importedStatus: 'pending',
              candidates: [
                {
                  requestId: '111111111111111111111111',
                  category: 'other',
                  submittedAt: '2025-01-01T00:00:10.000Z',
                  matchKind: 'suggested',
                  reason:
                    'same sender, same category, submitted within 60 seconds, equivalent message after formatting normalisation',
                  timeDifferenceSeconds: 10,
                  competingCandidateCount: 2,
                  currentStatus: 'open',
                  importedStatus: 'pending',
                },
                {
                  requestId: '222222222222222222222222',
                  category: 'other',
                  submittedAt: '2025-01-01T00:00:20.000Z',
                  matchKind: 'suggested',
                  reason:
                    'same sender, same category, submitted within 60 seconds, equivalent message after formatting normalisation',
                  timeDifferenceSeconds: 20,
                  competingCandidateCount: 2,
                  currentStatus: 'new',
                  importedStatus: 'pending',
                },
              ],
            },
            {
              zendeskTicketId: 790,
              category: 'other',
              submittedAt: '2025-01-01T00:00:00.000Z',
              importedStatus: 'pending',
              candidates: [
                {
                  requestId: '111111111111111111111111',
                  category: 'other',
                  submittedAt: '2025-01-01T00:00:10.000Z',
                  matchKind: 'suggested',
                  reason:
                    'same sender, same category, submitted within 60 seconds, equivalent message after formatting normalisation',
                  timeDifferenceSeconds: 10,
                  competingCandidateCount: 2,
                  currentStatus: 'open',
                  importedStatus: 'pending',
                },
                {
                  requestId: '333333333333333333333333',
                  category: 'other',
                  submittedAt: '2025-01-01T00:00:30.000Z',
                  matchKind: 'suggested',
                  reason:
                    'same sender, same category, submitted within 60 seconds, equivalent message after formatting normalisation',
                  timeDifferenceSeconds: 30,
                  competingCandidateCount: 2,
                  currentStatus: 'new',
                  importedStatus: 'pending',
                },
              ],
            },
          ],
          expiresAt: '2025-01-01T00:30:00.000Z',
        },
      } as never)
      .mockResolvedValueOnce({
        data: { applied: 1, alreadyApplied: 0, skipped: 0 },
      } as never);
    const onApplied = jest.fn();
    render(<SupportStatusImport onApplied={onApplied} />);
    fireEvent.change(screen.getByLabelText('Reduced JSON manifest'), {
      target: { files: [fileFrom(JSON.stringify(v2Manifest))] },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview status changes' }),
    );

    expect(await screen.findByText(/2 tickets with suggestions/)).toBeVisible();
    const [requestLink] = screen.getAllByRole('link', {
      name: 'Request 111111111111111111111111',
    });
    expect(requestLink).toHaveAttribute(
      'href',
      '/admin/support/requests/111111111111111111111111',
    );
    expect(requestLink).toHaveAttribute('target', '_blank');
    expect(
      screen.queryByText(/example\.test|Fictional private message/i),
    ).not.toBeInTheDocument();
    const apply = screen.getByRole('button', { name: 'Apply status changes' });
    expect(apply).toBeDisabled();
    const [first, firstOnOtherTicket] = screen.getAllByRole('checkbox', {
      name: /Request 111111111111111111111111/,
    });
    const second = screen.getByRole('checkbox', {
      name: /Request 222222222222222222222222/,
    });
    fireEvent.click(first);
    expect(apply).toBeEnabled();
    expect(firstOnOtherTicket).toBeDisabled();
    fireEvent.click(first);
    expect(first).not.toBeChecked();
    expect(apply).toBeDisabled();
    fireEvent.click(first);
    expect(first).toBeChecked();
    expect(firstOnOtherTicket).toBeDisabled();
    fireEvent.click(second);
    expect(first).not.toBeChecked();
    expect(firstOnOtherTicket).toBeEnabled();
    expect(second).toBeChecked();
    fireEvent.click(apply);
    expect(
      await screen.findByText(/Applied 1; already applied 0; skipped 0/),
    ).toBeVisible();
    expect(post).toHaveBeenLastCalledWith('/api/admin/support-import/apply', {
      previewId: 'suggestion-preview',
      selectedMatches: [
        { zendeskTicketId: 789, requestId: '222222222222222222222222' },
      ],
    });
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it('shows one suggested ticket in the singular and clears selections on a new preview and file', async () => {
    const suggestion = {
      previewId: 'suggestion-preview-one',
      counts: {
        total: 1,
        eligible: 0,
        suggested: 1,
        alreadyApplied: 0,
        skipped: 1,
        skippedByReason: {},
      },
      changes: [],
      matchReviews: [
        {
          zendeskTicketId: 789,
          category: 'other',
          submittedAt: null,
          importedStatus: 'pending',
          candidates: [
            {
              requestId: '111111111111111111111111',
              category: 'other',
              submittedAt: null,
              matchKind: 'suggested',
              reason:
                'same sender, same category, submitted within 60 seconds, equivalent message after formatting normalisation',
              timeDifferenceSeconds: 10,
              competingCandidateCount: 1,
              currentStatus: 'open',
              importedStatus: 'pending',
            },
          ],
        },
      ],
      expiresAt: '2025-01-01T00:30:00.000Z',
    };
    post
      .mockResolvedValueOnce({ data: suggestion } as never)
      .mockResolvedValueOnce({
        data: { ...suggestion, previewId: 'suggestion-preview-two' },
      } as never)
      .mockResolvedValueOnce({
        data: {
          previewId: 'exact-preview',
          counts: {
            total: 1,
            eligible: 1,
            suggested: 0,
            alreadyApplied: 0,
            skipped: 0,
            skippedByReason: {},
          },
          changes: [
            {
              requestId: '111111111111111111111111',
              zendeskTicketId: 790,
              currentStatus: 'open',
              importedStatus: 'pending',
              matchKind: 'exact',
              reason: 'exact request fingerprint',
              updatedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
          matchReviews: [],
          expiresAt: '2025-01-01T00:30:00.000Z',
        },
      } as never)
      .mockResolvedValueOnce({
        data: { applied: 1, alreadyApplied: 0, skipped: 0 },
      } as never);
    render(<SupportStatusImport />);
    const picker = screen.getByLabelText('Reduced JSON manifest');
    fireEvent.change(picker, {
      target: {
        files: [fileFrom(JSON.stringify({ ...manifest, version: 2 }))],
      },
    });
    const previewButton = screen.getByRole('button', {
      name: 'Preview status changes',
    });
    fireEvent.click(previewButton);
    expect(await screen.findByText(/1 ticket with suggestions/)).toBeVisible();
    expect(
      screen.getByRole('heading', {
        name: /Zendesk ticket 789.*time unavailable/,
      }),
    ).toBeVisible();
    expect(
      screen
        .getByRole('link', { name: 'Request 111111111111111111111111' })
        .closest('label'),
    ).toHaveTextContent('time unavailable');
    const candidate = screen.getByRole('checkbox', {
      name: /Request 111111111111111111111111/,
    });
    fireEvent.click(candidate);
    expect(candidate).toBeChecked();

    fireEvent.click(previewButton);
    await waitFor(() =>
      expect(post).toHaveBeenNthCalledWith(
        2,
        '/api/admin/support-import/preview',
        expect.anything(),
      ),
    );
    const refreshedCandidate = await screen.findByRole('checkbox', {
      name: /Request 111111111111111111111111/,
    });
    expect(refreshedCandidate).not.toBeChecked();
    fireEvent.click(refreshedCandidate);

    fireEvent.change(picker, {
      target: { files: [fileFrom(JSON.stringify(manifest))] },
    });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(previewButton);
    expect(
      await screen.findByText(/1 eligible, 0 already applied, 0 skipped/),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply status changes' }),
    );
    expect(
      await screen.findByText(/Applied 1; already applied 0; skipped 0/),
    ).toBeVisible();
    expect(post).toHaveBeenLastCalledWith('/api/admin/support-import/apply', {
      previewId: 'exact-preview',
      selectedMatches: [],
    });
  });

  it('rejects invalid JSON locally without sending it', async () => {
    render(<SupportStatusImport />);
    fireEvent.change(screen.getByLabelText('Reduced JSON manifest'), {
      target: { files: [fileFrom('not json')] },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview status changes' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /unable to read/i,
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects manifests above the upload bound before reading them', async () => {
    const file = fileFrom('{}');
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 });
    render(<SupportStatusImport />);
    fireEvent.change(screen.getByLabelText('Reduced JSON manifest'), {
      target: { files: [file] },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview status changes' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no larger than 10 MiB/i,
    );
    expect(post).not.toHaveBeenCalled();
  });

  it.each([
    'not an object',
    null,
    [],
    {},
    { version: 3, items: [] },
    { version: 1 },
    { version: 1, items: null },
  ])(
    'rejects invalid reduced manifest shapes before uploading: %j',
    async value => {
      render(<SupportStatusImport />);
      fireEvent.change(screen.getByLabelText('Reduced JSON manifest'), {
        target: { files: [fileFrom(JSON.stringify(value))] },
      });
      fireEvent.click(
        screen.getByRole('button', { name: 'Preview status changes' }),
      );
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Choose a valid reduced status manifest.',
      );
      expect(post).not.toHaveBeenCalled();
    },
  );

  it('retains a reviewed preview after an apply failure so staff can retry it', async () => {
    const preview = {
      previewId: 'preview-2',
      counts: {
        total: 1,
        eligible: 1,
        alreadyApplied: 0,
        skipped: 0,
        skippedByReason: {},
      },
      changes: [],
      expiresAt: '2025-01-01T00:30:00.000Z',
    };
    post
      .mockResolvedValueOnce({ data: preview } as never)
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({
        data: { applied: 1, alreadyApplied: 0, skipped: 0 },
      } as never);
    render(<SupportStatusImport />);
    fireEvent.change(screen.getByLabelText('Reduced JSON manifest'), {
      target: { files: [fileFrom(JSON.stringify(manifest))] },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview status changes' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Apply status changes' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to apply these support statuses.',
    );
    const retry = screen.getByRole('button', { name: 'Apply status changes' });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    expect(
      await screen.findByText(/Applied 1; already applied 0; skipped 0/),
    ).toBeVisible();
  });

  it('clears a selected file and any preview when the picker is cancelled', async () => {
    render(<SupportStatusImport />);
    const input = screen.getByLabelText('Reduced JSON manifest');
    fireEvent.change(input, { target: { files: [fileFrom('{}')] } });
    expect(
      screen.getByRole('button', { name: 'Preview status changes' }),
    ).toBeEnabled();
    fireEvent.change(input, { target: { files: [] } });
    expect(
      screen.getByRole('button', { name: 'Preview status changes' }),
    ).toBeDisabled();
  });

  it('shows matching skip reasons after preview and retains them after applying', async () => {
    const reasons = {
      'duplicate-ticket-id': 1,
      'duplicate-fingerprint': 2,
      'no-match': 3,
      'ambiguous-match': 4,
      'ticket-id-conflict': 5,
      'newer-local-activity': 6,
      'future-reason': 7,
    };
    post
      .mockResolvedValueOnce({
        data: {
          previewId: 'diagnostic-preview',
          counts: {
            total: 29,
            eligible: 1,
            alreadyApplied: 0,
            skipped: 28,
            skippedByReason: reasons,
          },
          changes: [],
          expiresAt: '2025-01-01T00:30:00.000Z',
        },
      } as never)
      .mockResolvedValueOnce({
        data: { applied: 1, alreadyApplied: 0, skipped: 28 },
      } as never);
    render(<SupportStatusImport />);
    const picker = screen.getByLabelText('Reduced JSON manifest');
    fireEvent.change(picker, {
      target: { files: [fileFrom(JSON.stringify(manifest))] },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview status changes' }),
    );
    const table = await screen.findByRole('table', {
      name: 'Skipped during matching',
    });
    expect(within(table).getByText(/No local request matches/)).toBeVisible();
    expect(within(table).getByText(/Several Zendesk tickets/)).toBeVisible();
    expect(within(table).getByText(/Several local requests/)).toBeVisible();
    expect(within(table).getByText(/newer activity/)).toBeVisible();
    expect(within(table).getByText('future-reason')).toBeVisible();
    for (const count of Object.values(reasons))
      expect(
        within(table).getByRole('cell', { name: String(count) }),
      ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply status changes' }),
    );
    expect(
      await screen.findByText(/Applied 1; already applied 0; skipped 28/),
    ).toBeVisible();
    expect(table).toBeVisible();
    fireEvent.change(picker, { target: { files: [] } });
    expect(
      screen.queryByRole('table', { name: 'Skipped during matching' }),
    ).not.toBeInTheDocument();
  });
});
