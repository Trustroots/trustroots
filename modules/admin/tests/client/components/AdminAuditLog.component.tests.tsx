import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import AdminAuditLog from '@/modules/admin/client/components/AdminAuditLog.component';
import * as api from '@/modules/admin/client/api/audit-log.api';
import type {
  AdminAuditLogEntry,
  AuditActor,
} from '@/modules/admin/client/api/audit-log.api';

vi.mock('@trustroots/core/auth', async () =>
  (await import('@/testutils/client/auth.testutil')).mockAuthModule(),
);
vi.mock('@tanstack/react-router', async () =>
  (
    await import('@/testutils/client/router-location.testutil')
  ).mockRouterModule(),
);

vi.mock('@/modules/admin/client/api/audit-log.api');

const mockedApi = {
  getAuditLog: vi.mocked(api.getAuditLog),
  getAuditLogActors: vi.mocked(api.getAuditLogActors),
};

beforeEach(() => {
  mockedApi.getAuditLogActors.mockResolvedValue([
    { _id: 'staff-1', username: 'river', roles: ['admin'] },
  ]);
});
afterEach(() => vi.resetAllMocks());
function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
describe('Compact audit log', () => {
  it('summarises useful fields and keeps full details collapsed', async () => {
    mockedApi.getAuditLog.mockResolvedValueOnce([
      {
        _id: 'audit-1',
        date: '2026-01-01',
        route: '/api/admin/users',
        user: { _id: 'staff-1', username: 'river' },
        ipHash: 'a'.repeat(64),
        body: {
          username: 'forest',
          userId: '',
          absent: null,
          enabled: false,
          nested: { value: 1 },
        },
        query: { page: 1, limit: 20 },
        params: { id: 'fictional-id' },
      },
    ]);
    const { container } = render(<AdminAuditLog />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    await screen.findByRole('table');
    const summary = container.querySelector('.admin-audit-log-summary')!;
    expect(summary).toHaveTextContent('username: forest');
    expect(summary).toHaveTextContent('enabled: false');
    expect(summary).toHaveTextContent('nested: {"value":1}');
    expect(summary).not.toHaveTextContent('userId');
    expect(summary).not.toHaveTextContent('page');
    expect(summary).not.toHaveTextContent('limit');
    const details = container.querySelector('details')!;
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByRole('link', { name: 'river' })).toHaveAttribute(
      'href',
      '/admin/user/river',
    );
    expect(details).toHaveTextContent('Audit log ID: audit-1');
    expect(details).toHaveTextContent('"limit": 20');
  });
  it('renders missing metadata and empty summaries', async () => {
    mockedApi.getAuditLog.mockResolvedValueOnce([{ _id: 'audit-2' }]);
    render(<AdminAuditLog />);
    await screen.findByText('Unknown route');
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByRole('table').querySelector('time')).toHaveTextContent(
      '—',
    );
    expect(
      screen.getByText('IP identifier: Not collected'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('table').querySelector('.admin-audit-log-summary'),
    ).toHaveTextContent('—');
  });

  it('handles invalid audit timestamps', async () => {
    mockedApi.getAuditLog.mockResolvedValueOnce([
      { _id: 'invalid-time', date: 'invalid' },
    ]);
    render(<AdminAuditLog />);
    const table = await screen.findByRole('table');
    expect(table.querySelector('time')).toHaveTextContent('—');
  });
  it('combines staff and team filters and displays empty results', async () => {
    mockedApi.getAuditLog.mockResolvedValue([]);
    render(<AdminAuditLog />);
    await screen.findByRole('option', { name: 'river' });
    fireEvent.change(screen.getByLabelText('Performed by'), {
      target: { value: 'river' },
    });
    await waitFor(() =>
      expect(mockedApi.getAuditLog).toHaveBeenLastCalledWith({
        username: 'river',
        action: '',
        hideOwn: true,
        team: '',
      }),
    );
    fireEvent.change(screen.getByLabelText('Team'), {
      target: { value: 'welcome-team' },
    });
    await waitFor(() =>
      expect(mockedApi.getAuditLog).toHaveBeenLastCalledWith({
        username: 'river',
        action: '',
        hideOwn: true,
        team: 'welcome-team',
      }),
    );
    expect(await screen.findByText('Nothing found...')).toBeInTheDocument();
    const ownActions = screen.getByRole('checkbox', {
      name: 'Don’t show my actions',
    });
    expect(ownActions).toBeChecked();
    fireEvent.change(screen.getByLabelText('Action'), {
      target: { value: 'suspend' },
    });
    fireEvent.click(ownActions);
    await waitFor(() =>
      expect(mockedApi.getAuditLog).toHaveBeenLastCalledWith({
        username: 'river',
        action: 'suspend',
        hideOwn: false,
        team: 'welcome-team',
      }),
    );
  });
  it('handles list errors', async () => {
    mockedApi.getAuditLog.mockRejectedValue(new Error('Failed'));
    render(<AdminAuditLog />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the audit log. Please try again.',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('reports actor option errors while keeping the loaded audit table visible', async () => {
    mockedApi.getAuditLogActors.mockRejectedValue(new Error('Failed'));
    mockedApi.getAuditLog.mockResolvedValue([
      { _id: 'audit-actor-error', route: '/api/admin/users' },
    ]);
    render(<AdminAuditLog />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the staff list. Please try again.',
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('/api/admin/users')).toBeInTheDocument();
  });
  type PendingAction = 'resolve' | 'reject';

  it.each(['resolve', 'reject'] as PendingAction[])(
    'ignores requests that %s after unmount',
    async (method: PendingAction) => {
      const list = pending<AdminAuditLogEntry[]>();
      const actors = pending<AuditActor[]>();
      mockedApi.getAuditLog.mockReturnValue(list.promise);
      mockedApi.getAuditLogActors.mockReturnValue(actors.promise);
      const { unmount } = render(<AdminAuditLog />);
      unmount();
      await act(async () => {
        list[method]([]);
        actors[method]([]);
      });
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    },
  );
  it('ignores a stale result after changing filters', async () => {
    const old = pending<AdminAuditLogEntry[]>();
    mockedApi.getAuditLog
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce([]);
    render(<AdminAuditLog />);
    fireEvent.change(screen.getByLabelText('Team'), {
      target: { value: 'admin' },
    });
    await screen.findByText('Nothing found...');
    await act(async () =>
      old.resolve([{ _id: 'stale', route: 'Stale route' }]),
    );
    expect(screen.queryByText('Stale route')).not.toBeInTheDocument();
  });
});
