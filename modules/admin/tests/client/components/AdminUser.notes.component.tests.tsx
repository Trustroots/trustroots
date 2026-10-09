import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminUser from '@/modules/admin/client/components/AdminUser.component';
import * as usersApi from '@/modules/admin/client/api/users.api';
import * as notesApi from '@/modules/admin/client/api/admin-notes.api';

jest.mock('@/modules/admin/client/api/users.api');
jest.mock('@/modules/admin/client/api/admin-notes.api');
const mockedUsersApi = jest.mocked(usersApi);
const mockedNotesApi = jest.mocked(notesApi);

type MockEditorProps = {
  onChange: (value: string) => void;
  text: string;
};

jest.mock('@/modules/core/client/components/TrEditor', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function Editor({ onChange, text }: MockEditorProps) {
    return (
      <textarea
        aria-label="Draft note"
        onChange={event => onChange(event.target.value)}
        value={text}
      />
    );
  }
  return Editor;
});

const userId = '111111111111111111111111';

afterEach(() => {
  jest.resetAllMocks();
  window.history.pushState({}, '', '/');
});

type RoleChangeCase = [string, string[]];
type AdminNoteFixture = {
  _id: string;
  admin: { _id: string; username: string };
  date: string;
  note: string;
};

it.each([
  ['Suspend', ['user']],
  ['Make greeter', ['user']],
  ['Remove greeter', ['user', 'welcome-team']],
] as RoleChangeCase[])(
  'refreshes audit notes after %s without discarding a draft',
  async (label, roles) => {
    window.history.pushState({}, '', `/admin/user?id=${userId}`);
    mockedUsersApi.getUser.mockResolvedValue({
      contacts: [],
      offers: [],
      profile: { _id: userId, username: 'river', roles },
    });
    mockedUsersApi.setUserRole.mockResolvedValue({});
    const auditNote: AdminNoteFixture = {
      _id: 'audit-note',
      admin: { _id: '222222222222222222222222', username: 'forest' },
      date: '2026-01-01T00:00:00.000Z',
      note: '<p>Role change recorded.</p>',
    };
    mockedNotesApi.listNotes
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([auditNote]);

    render(<AdminUser />);
    const draft = await screen.findByLabelText('Draft note');
    await waitFor(() =>
      expect(mockedNotesApi.listNotes).toHaveBeenCalledTimes(1),
    );
    fireEvent.change(draft, { target: { value: 'An unfinished note.' } });
    fireEvent.click(screen.getByRole('button', { name: label, exact: true }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: label,
        exact: true,
      }),
    );

    expect(
      await screen.findByText('Role change recorded.'),
    ).toBeInTheDocument();
    expect(mockedNotesApi.listNotes).toHaveBeenLastCalledWith(userId);
    expect(mockedNotesApi.listNotes).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Draft note')).toHaveValue(
      'An unfinished note.',
    );
  },
);
