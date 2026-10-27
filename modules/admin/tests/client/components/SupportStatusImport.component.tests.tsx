import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
        { previewId: 'preview-1' },
      ),
    );
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
    { version: 2, items: [] },
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
});
