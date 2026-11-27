import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import AdminEmail from '@/modules/admin/client/components/AdminEmail.component';
import httpClient from '@trustroots/core/http-client';
import type { EmailQueueSnapshot } from '@/modules/admin/shared/email-queue.mts';

vi.mock('@trustroots/core/http-client', () => ({
  default: { get: vi.fn() },
}));
vi.mock('@/modules/admin/client/components/AdminHeader.component', () => ({
  default: () => null,
}));

const get = vi.mocked(httpClient.get);
const snapshot: EmailQueueSnapshot = {
  capturedAt: '2025-01-02T12:00:00.000Z',
  mailMode: 'capture',
  queued: 12,
  oldestDueSeconds: 0,
  retrying: 3,
  exhausted: 1,
  authenticationOrConfiguration: 1,
  workerHealthy: true,
  stalledAttempts: 0,
  maxProcessingMs: null,
};

beforeEach(() => {
  get.mockReset();
});

it('shows queue health and refreshes the readings', async () => {
  get.mockResolvedValueOnce({ data: snapshot }).mockResolvedValueOnce({
    data: {
      ...snapshot,
      workerHealthy: false,
      oldestDueSeconds: 120.5,
      maxProcessingMs: 900,
    },
  });

  render(<AdminEmail />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(
    await screen.findByRole('row', { name: 'Worker heartbeat Healthy' }),
  ).toBeVisible();
  expect(screen.getByText(/Capture.*outgoing delivery disabled/)).toBeVisible();
  expect(screen.getByText('None overdue')).toBeVisible();
  expect(screen.getByText('No recent attempts')).toBeVisible();
  expect(screen.getByText(/2025-01-02 12:00:00 UTC/)).toBeVisible();
  expect(screen.getByRole('link', { name: /SparkPost/ })).toHaveAttribute(
    'href',
    '/admin/email/sparkpost',
  );

  fireEvent.click(screen.getByRole('button', { name: 'Refresh queue health' }));
  expect(await screen.findByText('No healthy heartbeat')).toBeVisible();
  expect(screen.getByText('121 s overdue')).toBeVisible();
  expect(screen.getByText('900 ms')).toBeVisible();
  expect(get).toHaveBeenCalledTimes(2);
});

it('keeps SparkPost available when the queue request fails', async () => {
  get.mockRejectedValue(new Error('Unavailable'));
  render(<AdminEmail />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load email queue health.',
  );
  expect(screen.getByRole('link', { name: /SparkPost/ })).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Refresh queue health' }),
  ).toBeEnabled();
});

it('aborts an outstanding request when leaving the overview', () => {
  let resolve!: (value: unknown) => void;
  get.mockReturnValueOnce(
    new Promise(done => {
      resolve = done;
    }),
  );
  const { unmount } = render(<AdminEmail />);
  const signal = get.mock.calls[0][1]?.signal;
  unmount();
  expect(signal?.aborted).toBe(true);
  resolve({ data: snapshot });
});

it('ignores a rejection from an aborted request', () => {
  let reject!: (error: Error) => void;
  get.mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  const { unmount } = render(<AdminEmail />);
  unmount();
  reject(new Error('Aborted'));
});
