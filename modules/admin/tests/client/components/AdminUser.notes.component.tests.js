import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminUser from '@/modules/admin/client/components/AdminUser.component';
import * as usersApi from '@/modules/admin/client/api/users.api';
import * as notesApi from '@/modules/admin/client/api/admin-notes.api';

jest.mock('@/modules/admin/client/api/users.api');
jest.mock('@/modules/admin/client/api/admin-notes.api');
jest.mock('@/modules/core/client/components/TrEditor', () => {
  const React = require('react');
  function Editor({ onChange, text }) {
    return (
      <textarea
        aria-label="Draft note"
        onChange={event => onChange(event.target.value)}
        value={text}
      />
    );
  }
  Editor.propTypes = {
    onChange: () => null,
    text: () => null,
  };
  return Editor;
});

const originalConfirm = window.confirm;
const userId = '111111111111111111111111';

afterEach(() => {
  jest.resetAllMocks();
  window.confirm = originalConfirm;
  window.history.pushState({}, '', '/');
});

it.each([
  ['Suspend', ['user']],
  ['Add to Welcome team', ['user']],
  ['Remove from Welcome team', ['user', 'welcome-team']],
])(
  'refreshes audit notes after %s without discarding a draft',
  async (label, roles) => {
    window.confirm = jest.fn(() => true);
    window.history.pushState({}, '', `/admin/user?id=${userId}`);
    usersApi.getUser.mockResolvedValue({
      contacts: [],
      offers: [],
      profile: { _id: userId, username: 'river', roles },
    });
    usersApi.setUserRole.mockResolvedValue({});
    notesApi.listNotes.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        _id: 'audit-note',
        admin: { _id: '222222222222222222222222', username: 'forest' },
        date: '2026-01-01T00:00:00.000Z',
        note: '<p>Role change recorded.</p>',
      },
    ]);

    render(<AdminUser />);
    const draft = await screen.findByLabelText('Draft note');
    await waitFor(() => expect(notesApi.listNotes).toHaveBeenCalledTimes(1));
    fireEvent.change(draft, { target: { value: 'An unfinished note.' } });
    fireEvent.click(screen.getByRole('button', { name: label, exact: true }));

    expect(
      await screen.findByText('Role change recorded.'),
    ).toBeInTheDocument();
    expect(notesApi.listNotes).toHaveBeenLastCalledWith(userId);
    expect(notesApi.listNotes).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Draft note')).toHaveValue(
      'An unfinished note.',
    );
  },
);
