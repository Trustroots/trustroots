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
    username: 'alpha',
  },
  {
    _id: '222222222222222222222222',
    created: '2025-01-01T00:00:00.000Z',
    displayName: 'Amy Example',
    email: 'a@example.test',
    username: 'zeta',
  },
  {
    _id: '333333333333333333333333',
    created: 'not-a-date',
  },
];

describe('<AdminUserResultsTable />', () => {
  it('sorts rows by every column and reverses the active sort', () => {
    render(<AdminUserResultsTable userResults={users} />);

    const rowOrder = () =>
      Array.from(document.querySelectorAll('tbody tr')).map(row =>
        row.textContent.includes('Zed Example')
          ? 'zed'
          : row.textContent.includes('Amy Example')
          ? 'amy'
          : 'empty',
      );

    expect(rowOrder()).toEqual(['zed', 'amy', 'empty']);
    expect(screen.getByText('Name').closest('th')).toHaveAttribute(
      'aria-sort',
      'none',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(rowOrder()).toEqual(['empty', 'amy', 'zed']);
    expect(screen.getByText('Name ▲').closest('th')).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Name ▲' }));
    expect(rowOrder()).toEqual(['zed', 'amy', 'empty']);

    fireEvent.click(screen.getByRole('button', { name: 'Username' }));
    expect(rowOrder()).toEqual(['empty', 'zed', 'amy']);

    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    expect(rowOrder()).toEqual(['empty', 'amy', 'zed']);

    fireEvent.click(screen.getByRole('button', { name: 'Signed up' }));
    expect(rowOrder()).toEqual(['empty', 'amy', 'zed']);
    fireEvent.click(screen.getByRole('button', { name: 'Signed up ▲' }));
    expect(rowOrder()).toEqual(['zed', 'amy', 'empty']);
  });
});
