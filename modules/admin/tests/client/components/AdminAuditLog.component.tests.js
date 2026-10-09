import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminAuditLog from '@/modules/admin/client/components/AdminAuditLog.component';
import * as api from '@/modules/admin/client/api/audit-log.api';
jest.mock('@/modules/admin/client/api/audit-log.api');
beforeEach(() => {
  api.getAuditLogActors.mockResolvedValue([
    { _id: 'staff-1', username: 'river', roles: ['admin'] },
  ]);
});
afterEach(() => jest.resetAllMocks());
function pending() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
describe('Compact audit log', () => {
  it('summarises useful fields and keeps full details collapsed', async () => {
    api.getAuditLog.mockResolvedValueOnce([
      {
        _id: 'audit-1',
        date: '2026-01-01',
        route: '/api/admin/users',
        user: { _id: 'staff-1', username: 'river' },
        ip: '127.0.0.1',
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
    const summary = container.querySelector('.admin-audit-log-summary');
    expect(summary).toHaveTextContent('username: forest');
    expect(summary).toHaveTextContent('enabled: false');
    expect(summary).toHaveTextContent('nested: {"value":1}');
    expect(summary).not.toHaveTextContent('userId');
    expect(summary).not.toHaveTextContent('page');
    expect(summary).not.toHaveTextContent('limit');
    expect(container.querySelector('details')).not.toHaveAttribute('open');
    expect(screen.getByRole('link', { name: 'river' })).toHaveAttribute(
      'href',
      '/admin/user/river',
    );
    expect(container.querySelector('details')).toHaveTextContent(
      'Audit log ID: audit-1',
    );
    expect(container.querySelector('details')).toHaveTextContent('"limit": 20');
  });
  it('renders missing metadata and empty summaries', async () => {
    api.getAuditLog.mockResolvedValueOnce([{ _id: 'audit-2' }]);
    render(<AdminAuditLog />);
    await screen.findByText('Unknown route');
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('Unknown time')).toBeInTheDocument();
    expect(screen.getByText('IP: Unknown IP address')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('handles invalid audit timestamps', async () => {
    api.getAuditLog.mockResolvedValueOnce([
      { _id: 'invalid-time', date: 'invalid' },
    ]);
    render(<AdminAuditLog />);
    expect(await screen.findByText('Unknown time')).toBeInTheDocument();
  });
  it('combines staff and team filters and displays empty results', async () => {
    api.getAuditLog.mockResolvedValue([]);
    render(<AdminAuditLog />);
    await screen.findByRole('option', { name: 'river' });
    fireEvent.change(screen.getByLabelText('Performed by'), {
      target: { value: 'river' },
    });
    await waitFor(() =>
      expect(api.getAuditLog).toHaveBeenLastCalledWith({
        username: 'river',
        team: '',
      }),
    );
    fireEvent.change(screen.getByLabelText('Team'), {
      target: { value: 'welcome-team' },
    });
    await waitFor(() =>
      expect(api.getAuditLog).toHaveBeenLastCalledWith({
        username: 'river',
        team: 'welcome-team',
      }),
    );
    expect(await screen.findByText('Nothing found...')).toBeInTheDocument();
  });
  it('handles list errors', async () => {
    api.getAuditLog.mockRejectedValue(new Error('Failed'));
    render(<AdminAuditLog />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the audit log. Please try again.',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('reports actor option errors while keeping the loaded audit table visible', async () => {
    api.getAuditLogActors.mockRejectedValue(new Error('Failed'));
    api.getAuditLog.mockResolvedValue([
      { _id: 'audit-actor-error', route: '/api/admin/users' },
    ]);
    render(<AdminAuditLog />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the staff list. Please try again.',
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('/api/admin/users')).toBeInTheDocument();
  });
  it.each(['resolve', 'reject'])(
    'ignores requests that %s after unmount',
    async method => {
      const list = pending();
      const actors = pending();
      api.getAuditLog.mockReturnValue(list.promise);
      api.getAuditLogActors.mockReturnValue(actors.promise);
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
    const old = pending();
    api.getAuditLog.mockReturnValueOnce(old.promise).mockResolvedValueOnce([]);
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
