import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import httpClient from '@/modules/core/client/api/http-client';
import AdminMongo from '@/modules/admin/client/components/AdminMongo.component';
import type { MongoServerDiagnostics } from '@/modules/admin/shared/mongo-diagnostics.mts';

jest.mock('@/modules/core/client/api/http-client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock(
  '@/modules/admin/client/components/AdminHeader.component',
  () => () => null,
);

const get = jest.mocked(httpClient.get);

beforeEach(() => {
  get.mockReset();
});

it('keeps collection storage visible when the job count is unavailable', async () => {
  get.mockResolvedValue({
    data: {
      capturedAt: '2025-01-02T12:00:00.000Z',
      server: {
        version: '6.0.12',
        topology: 'replicaSet',
        fcv: { version: '6.0', targetVersion: null, transitioning: false },
      },
      collections: [
        {
          name: 'agendaJobs',
          status: 'available',
          count: 2_000,
          storageBytes: 32_768,
          indexBytes: 4_096,
          reusableBytes: 0,
        },
        { name: 'agendaJobsArchived', status: 'missing' },
      ],
      jobs: null,
    },
  });
  render(<AdminMongo />);

  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(
    screen.getByRole('button', { name: 'Refresh snapshot' }),
  ).toBeDisabled();
  const storage = await screen.findByRole('table', {
    name: 'Collection storage',
  });
  const live = within(storage).getByRole('row', { name: /^agendaJobs / });
  expect(
    within(live)
      .getAllByRole('cell')
      .map(cell => cell.textContent),
  ).toEqual(['2,000', '32,768', '4,096', '0']);
  expect(storage).toHaveTextContent('Collection does not exist');
  expect(screen.getByText('2025-01-02 12:00:00 UTC')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Live job counts are unavailable',
  );
});

it('retries after a failed request and distinguishes unavailable storage from empty jobs', async () => {
  get.mockRejectedValueOnce(new Error('Request failed')).mockResolvedValueOnce({
    data: {
      capturedAt: '2025-01-02T12:00:00.000Z',
      server: {
        version: '6.0.12',
        topology: 'replicaSet',
        fcv: { version: '6.0', targetVersion: null, transitioning: false },
      },
      collections: [
        { name: 'agendaJobs', status: 'unavailable' },
        {
          name: 'agendaJobsArchived',
          status: 'available',
          count: 0,
          storageBytes: 0,
          indexBytes: 0,
          reusableBytes: null,
        },
      ],
      jobs: [],
    },
  });
  render(<AdminMongo />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh snapshot' }));
  expect(await screen.findByText('No live jobs.')).toBeInTheDocument();
  expect(
    screen.getByText('Storage statistics unavailable'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('cell', { name: /^Unavailable$/ }),
  ).toBeInTheDocument();
  expect(get).toHaveBeenCalledTimes(2);
});

it('shows each job state and uses zero for states absent from the snapshot', async () => {
  get.mockResolvedValue({
    data: {
      capturedAt: '2025-01-02T12:00:00.000Z',
      server: {
        version: '6.0.12',
        topology: 'replicaSet',
        fcv: { version: '6.0', targetVersion: null, transitioning: false },
      },
      collections: [],
      jobs: [{ name: 'sample job', counts: { completed: 4 } }],
    },
  });
  render(<AdminMongo />);

  const table = await screen.findByRole('table', { name: 'Live jobs by name' });
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map(cell => cell.textContent),
  ).toEqual([
    'Job name',
    'Queued',
    'Locked',
    'Completed',
    'Failed',
    'Disabled',
    'Unscheduled',
  ]);
  expect(
    within(table)
      .getAllByRole('cell')
      .map(cell => cell.textContent),
  ).toEqual(['0', '0', '4', '0', '0', '0']);
});

it.each<[MongoServerDiagnostics, string]>([
  [
    {
      version: '5.0.28',
      topology: 'standalone',
      fcv: { version: '5.0', targetVersion: null, transitioning: false },
    },
    'Aligned. Next series is 6.0.',
  ],
  [
    {
      version: '6.0.2',
      topology: 'sharded',
      fcv: { version: '5.0', targetVersion: null, transitioning: false },
    },
    'Server version and FCV do not match',
  ],
  [
    {
      version: '6.0.2',
      topology: 'replicaSet',
      fcv: { version: '6.0', targetVersion: '7.0', transitioning: true },
    },
    'FCV transition in progress',
  ],
  [
    {
      version: '7.0.5',
      topology: 'replicaSet',
      fcv: { version: '7.0', targetVersion: null, transitioning: false },
    },
    'Aligned at 7.0',
  ],
  [
    { version: null, topology: null, fcv: null },
    'Migration context unavailable',
  ],
  [
    {
      version: '8.0.1',
      topology: 'standalone',
      fcv: { version: '8.0', targetVersion: null, transitioning: false },
    },
    'Outside this migration path',
  ],
  [
    {
      version: '7.0.5',
      topology: 'replicaSet',
      fcv: { version: '7.0', targetVersion: null, transitioning: true },
    },
    'FCV transition in progress',
  ],
])('explains migration state: %s', async (server, context) => {
  get.mockResolvedValue({
    data: {
      capturedAt: '2025-01-02T12:00:00.000Z',
      server,
      collections: [],
      jobs: [],
    },
  });
  render(<AdminMongo />);
  const table = await screen.findByRole('table', {
    name: 'MongoDB migration metadata',
  });
  expect(table).toHaveTextContent(context);
  if (server.topology)
    expect(table).toHaveTextContent(
      {
        standalone: 'Standalone',
        replicaSet: 'Replica set',
        sharded: 'Sharded cluster',
      }[server.topology],
    );
  if (server.fcv?.targetVersion)
    expect(table).toHaveTextContent('6.0 → 7.0 (transition in progress)');
});

it('cancels the request when leaving the dashboard', async () => {
  let rejectRequest: (error: Error) => void = () => undefined;
  get.mockImplementation(
    () =>
      new Promise((_, reject) => {
        rejectRequest = reject;
      }),
  );
  const { unmount } = render(<AdminMongo />);
  unmount();
  expect(get.mock.calls[0][1]?.signal?.aborted).toBe(true);
  await act(async () => rejectRequest(new Error('Cancelled')));
});
