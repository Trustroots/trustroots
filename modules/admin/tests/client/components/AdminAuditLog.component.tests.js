import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminAuditLog from '@/modules/admin/client/components/AdminAuditLog.component';
import * as auditLogApi from '@/modules/admin/client/api/audit-log.api';

jest.mock('@/modules/admin/client/api/audit-log.api');

afterEach(() => {
  jest.clearAllMocks();
});

describe('<AdminAuditLog />', () => {
  it('loads audit log entries with route, user, request data, and metadata', async () => {
    auditLogApi.getAuditLog.mockResolvedValueOnce([
      {
        _id: 'audit-1',
        body: { reason: 'support' },
        date: '2026-04-05T06:07:08.000Z',
        ip: '127.0.0.1',
        params: { id: 'member-1' },
        query: { search: 'alice' },
        route: '/api/admin/users',
        user: {
          _id: '111111111111111111111111',
          displayName: 'Admin Alice',
          username: 'admin-alice',
        },
      },
    ]);

    render(<AdminAuditLog />);

    expect(await screen.findByText('/api/admin/users')).toBeInTheDocument();
    expect(screen.getByText('Admin Alice')).toHaveAttribute(
      'href',
      '/admin/user?id=111111111111111111111111',
    );
    expect(screen.getByText(/127.0.0.1/)).toBeInTheDocument();
    expect(screen.getByText(/"reason": "support"/)).toBeInTheDocument();
    expect(screen.getByText(/"id": "member-1"/)).toBeInTheDocument();
    expect(screen.getByText(/"search": "alice"/)).toBeInTheDocument();
    expect(screen.getByText('audit-1')).toBeInTheDocument();
  });

  it('renders empty and unknown-entry states', async () => {
    auditLogApi.getAuditLog.mockResolvedValueOnce([
      {
        _id: 'audit-2',
        date: '2026-05-06T07:08:09.000Z',
      },
    ]);

    render(<AdminAuditLog />);

    expect(screen.getByText('Nothing found...')).toBeInTheDocument();
    expect(await screen.findByText('Unknown route')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText(/Unknown IP address/)).toBeInTheDocument();
  });
});
