import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import MemberAdmin from '@/modules/admin/client/components/AdminUser.component';
import * as usersApi from '@/modules/admin/client/api/users.api';
import * as notesApi from '@/modules/admin/client/api/admin-notes.api';

function AdminUser(
  props: Omit<React.ComponentProps<typeof MemberAdmin>, 'MemberProfile'>,
) {
  return <MemberAdmin {...props} MemberProfile={() => null} />;
}

vi.mock('@/modules/core/client/react-app/auth', async () =>
  (await import('@/testutils/client/auth.testutil')).mockAuthModule(),
);
vi.mock('@tanstack/react-router', async () =>
  (
    await import('@/testutils/client/router-location.testutil')
  ).mockRouterModule(),
);

vi.mock('@/modules/admin/client/api/users.api');
vi.mock('@/modules/admin/client/api/admin-notes.api');
const mockedUsersApi = vi.mocked(usersApi);
const mockedNotesApi = vi.mocked(notesApi);

type MockEditorProps = {
  onChange: (value: string) => void;
  text: string;
};

vi.mock('@/modules/core/client/components/TrEditor', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  function Editor({ onChange, text }: MockEditorProps) {
    return (
      <textarea
        aria-label="Draft note"
        onChange={event => onChange(event.target.value)}
        value={text}
      />
    );
  }
  return { default: Editor };
});

const userId = '111111111111111111111111';

afterEach(() => {
  vi.resetAllMocks();
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
    fireEvent.click(screen.getByRole('button', { name: label }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: label,
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
