import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import httpClient from '@/modules/core/client/api/http-client';
import AdminMongo from '@/modules/admin/client/components/AdminMongo.component';
import type { MongoServerDiagnostics } from '@/modules/admin/shared/mongo-diagnostics.mts';

vi.mock('@/modules/core/client/api/http-client', () => ({
  __esModule: true,
  default: { get: vi.fn() },
}));
vi.mock('@/modules/admin/client/components/AdminHeader.component', () => ({
  default: () => null,
}));

const get = vi.mocked(httpClient.get);

beforeEach(() => {
  get.mockReset();
});

it('shows the current maintenance status and expands collection indexes', async () => {
  get.mockResolvedValue({
    data: {
      capturedAt: '2025-01-02T12:00:00.000Z',
      server: { version: '7.0.1', topology: 'standalone', fcv: null },
      collections: [],
      jobs: [],
      jobsCapturedAt: null,
      history: [],
      indexInventory: {
        circleDiscovery: [
          {
            name: 'circle_discovery_member_seen',
            collection: 'users',
            status: 'matches',
          },
          {
            name: 'circle_discovery_recommenders',
            collection: 'experiences',
            status: 'missing',
          },
        ],
        collections: [
          {
            name: 'users',
            indexes: [{ name: 'fixture_index', fields: ['seen (-1)'] }],
          },
          { name: 'experiences', indexes: null },
          { name: 'empty_fixture', indexes: [] },
        ],
      },
    },
  });
  render(<AdminMongo />);

  const maintenance = await screen.findByRole('table', {
    name: 'Circle discovery indexes',
  });
  expect(
    within(maintenance).getByRole('row', { name: /users/ }),
  ).toHaveTextContent('Definition matches');
  expect(
    within(maintenance).getByRole('row', { name: /experiences/ }),
  ).toHaveTextContent('Missing');
  fireEvent.click(screen.getByText('Collection index inventory'));
  const inventory = screen.getByRole('table', {
    name: 'Collection index inventory',
  });
  expect(inventory).toHaveTextContent('fixture_index seen (-1)');
  expect(inventory).toHaveTextContent('experiencesUnavailable');
  expect(inventory).toHaveTextContent('empty_fixtureNo indexes');
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
          storageBytes: 6_093_045_760,
          indexBytes: 74_768_384,
          reusableBytes: 0,
        },
        { name: 'agendaJobsArchived', status: 'missing' },
      ],
      jobs: null,
      history: null,
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
  ).toEqual(['2,000', '6.09 GB', '74.77 MB', '0 B']);
  expect(within(live).getByRole('cell', { name: '6.09 GB' })).toHaveAttribute(
    'title',
    '6,093,045,760 bytes',
  );
  expect(storage).toHaveTextContent('Collection does not exist');
  expect(screen.getByText('2025-01-02 12:00:00 UTC')).toBeInTheDocument();
  expect(screen.getByText(/Live job counts are unavailable/)).toHaveRole(
    'alert',
  );
  expect(screen.getByText(/Daily storage history is unavailable/)).toHaveRole(
    'alert',
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
      jobsCapturedAt: '2025-01-01T03:00:00.000Z',
      jobs: [],
      history: [],
    },
  });
  render(<AdminMongo />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh snapshot' }));
  expect(await screen.findByText('No Agenda jobs.')).toBeInTheDocument();
  expect(screen.getByText('Saved inventory from')).toHaveTextContent(
    '2025-01-01 03:00:00 UTC',
  );
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
      jobs: [
        {
          name: 'sample job',
          counts: { completed: 4 },
          total: 4,
          bsonBytes: 1_024,
          oldestCompletedAt: '2024-12-02T12:00:00.000Z',
        },
        {
          name: 'pending job',
          counts: { queued: 1 },
          total: 1,
          bsonBytes: 40,
          oldestCompletedAt: null,
        },
      ],
      history: [
        {
          capturedAt: '2025-01-01T03:00:00.000Z',
          collections: [{ name: 'agendaJobsArchived', status: 'missing' }],
        },
      ],
    },
  });
  render(<AdminMongo />);

  const table = await screen.findByRole('table', {
    name: 'Agenda jobs by name',
  });
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map(cell => cell.textContent),
  ).toEqual([
    'Job name',
    'Total',
    'BSON size',
    'Queued',
    'Locked',
    'Completed',
    'Failed',
    'Disabled',
    'Unscheduled',
    'Oldest completed (UTC)',
  ]);
  expect(
    within(within(table).getByRole('row', { name: /^sample job / }))
      .getAllByRole('cell')
      .map(cell => cell.textContent),
  ).toEqual(['4', '1.02 kB', '0', '0', '4', '0', '0', '0', '2024-12-02']);
  const pending = within(table).getByRole('row', { name: /^pending job / });
  expect(within(pending).getByRole('cell', { name: '—' })).toBeInTheDocument();
  expect(
    within(pending).getByRole('cell', { name: '40 B' }),
  ).toBeInTheDocument();
  const history = screen.getByRole('table', { name: 'Daily Agenda storage' });
  expect(history).toHaveTextContent('2025-01-01');
  expect(history).toHaveTextContent('Collection does not exist');
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
      history: [],
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
