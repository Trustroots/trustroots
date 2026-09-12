import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminUserResultsTable from '@/modules/admin/client/components/AdminUserResultsTable.component';

const users = [
  {
    _id: '111111111111111111111111',
    created: '2026-01-01T00:00:00.000Z',
    displayName: 'Zed Example',
    email: 'z@example.test',
    lastIpAddress: '203.0.113.10',
    username: 'alpha',
  },
  {
    _id: '222222222222222222222222',
    created: '2025-01-01T00:00:00.000Z',
    displayName: 'Amy Example',
    email: 'a@example.test',
    lastIpAddress: '203.0.113.20',
    username: 'zeta',
  },
  {
    _id: '333333333333333333333333',
    created: 'not-a-date',
  },
];

describe('<AdminUserResultsTable />', () => {
  it('requests server sorting for every column', () => {
    const onSortChange = jest.fn();
    render(
      <AdminUserResultsTable
        onSortChange={onSortChange}
        sort={{ column: 'username', direction: 'ascending' }}
        userResults={users}
      />,
    );

    expect(screen.getByText('Name').closest('th')).toHaveAttribute(
      'aria-sort',
      'none',
    );
    expect(screen.getByText('Username ▲').closest('th')).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Username ▲' }));
    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    fireEvent.click(screen.getByRole('button', { name: 'Signed up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Last IP' }));

    expect(onSortChange.mock.calls).toEqual([
      [{ column: 'displayName', direction: 'ascending' }],
      [{ column: 'username', direction: 'descending' }],
      [{ column: 'email', direction: 'ascending' }],
      [{ column: 'created', direction: 'ascending' }],
      [{ column: 'lastIpAddress', direction: 'ascending' }],
    ]);
    expect(screen.getByRole('link', { name: '203.0.113.10' })).toHaveAttribute(
      'href',
      '/admin/user?ip=203.0.113.10',
    );
    expect(screen.getByRole('link', { name: '203.0.113.10' })).toHaveAttribute(
      'target',
      '_self',
    );
  });

  it('shows page metadata and requests adjacent pages', () => {
    const onPageChange = jest.fn();
    const { rerender } = render(
      <AdminUserResultsTable
        onPageChange={onPageChange}
        pagination={{ page: 2, pageSize: 150, total: 301, totalPages: 3 }}
        userResults={users}
      />,
    );

    expect(screen.getByText('301 user(s). Page 2 of 3.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange.mock.calls).toEqual([[1], [3]]);

    rerender(
      <AdminUserResultsTable
        pagination={{ page: 1, pageSize: 150, total: 3, totalPages: 1 }}
        userResults={users}
      />,
    );
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));

    rerender(
      <AdminUserResultsTable
        pagination={{ page: 1, pageSize: 150, total: 301, totalPages: 3 }}
        sort={{ column: 'username', direction: 'descending' }}
        userResults={users}
      />,
    );
    expect(screen.getByRole('button', { name: 'Username ▼' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  });
});
