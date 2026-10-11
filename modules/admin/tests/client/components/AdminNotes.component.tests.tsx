import React, { type ChangeEvent, type KeyboardEvent } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminNotes from '@/modules/admin/client/components/AdminNotes';
import * as notesApi from '@/modules/admin/client/api/admin-notes.api';

jest.mock('@/modules/admin/client/api/admin-notes.api');
const mockedNotesApi = jest.mocked(notesApi);
jest.mock('@/modules/core/client/components/TimeAgo', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockTimeAgo({ date }: { date: Date }) {
    return <time>{date.toISOString()}</time>;
  }

  return MockTimeAgo;
});
jest.mock('@/modules/core/client/components/TrEditor', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockTrEditor({
    onChange,
    onCtrlEnter,
    placeholder,
    text,
  }: {
    onChange: (value: string) => void;
    onCtrlEnter: () => void | Promise<void>;
    placeholder: string;
    text: string;
  }) {
    return (
      <textarea
        aria-label={placeholder}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(event.target.value)
        }
        onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
          if (event.ctrlKey && event.key === 'Enter') {
            onCtrlEnter();
          }
        }}
        value={text}
      />
    );
  }

  return MockTrEditor;
});

const originalAlert = window.alert;

afterEach(() => {
  jest.clearAllMocks();
  window.alert = originalAlert;
});

const userId = '111111111111111111111111';

type NoteFixture = {
  _id: string;
  admin: { _id: string; displayName: string; username: string };
  date: string;
  note: string;
};

const makeNote = (overrides: Partial<NoteFixture> = {}): NoteFixture => ({
  _id: 'note-1',
  admin: {
    _id: '222222222222222222222222',
    displayName: 'Admin Alice',
    username: 'admin-alice',
  },
  date: '2025-05-06T07:08:09.000Z',
  note: '<p>Needs review</p>',
  ...overrides,
});

describe('<AdminNotes />', () => {
  it('loads and renders existing notes', async () => {
    mockedNotesApi.listNotes.mockResolvedValueOnce([makeNote()]);

    render(<AdminNotes id={userId} />);

    expect(
      await screen.findByRole('link', { name: 'admin-alice (Admin Alice)' }),
    ).toHaveAttribute('href', '/admin/user/admin-alice');
    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(mockedNotesApi.listNotes).toHaveBeenCalledWith(userId);
  });

  it('adds a note and refreshes the list', async () => {
    mockedNotesApi.listNotes
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeNote({ note: '<p>Fresh note</p>' })]);
    mockedNotesApi.addNote.mockResolvedValueOnce({});

    render(<AdminNotes id={userId} />);

    await waitFor(() =>
      expect(mockedNotesApi.listNotes).toHaveBeenCalledTimes(1),
    );

    fireEvent.change(screen.getByLabelText('Write a note'), {
      target: { value: '<p>Fresh note</p>' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

    await waitFor(() =>
      expect(mockedNotesApi.addNote).toHaveBeenCalledWith({
        note: '<p>Fresh note</p>',
        userId,
      }),
    );
    expect(await screen.findByText('Fresh note')).toBeInTheDocument();
    expect(mockedNotesApi.listNotes).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Write a note')).toHaveValue('');
  });

  it('reports write failures and still refreshes notes', async () => {
    window.alert = jest.fn();
    mockedNotesApi.listNotes.mockResolvedValue([]);
    mockedNotesApi.addNote.mockRejectedValueOnce(new Error('write failed'));

    render(<AdminNotes id={userId} />);

    await waitFor(() =>
      expect(mockedNotesApi.listNotes).toHaveBeenCalledTimes(1),
    );
    fireEvent.change(screen.getByLabelText('Write a note'), {
      target: { value: '<p>Broken note</p>' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(
        `Could not write admin notes for user ${userId}`,
      ),
    );
    expect(mockedNotesApi.listNotes).toHaveBeenCalledTimes(2);
  });

  it('logs failed note loads and leaves the editor usable', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockedNotesApi.listNotes.mockRejectedValueOnce(new Error('load failed'));

    render(<AdminNotes id={userId} />);

    await waitFor(() =>
      expect(log).toHaveBeenCalledWith(
        `Could not load admin notes for user ${userId}`,
      ),
    );
    expect(screen.getByRole('button', { name: 'Save note' })).toBeDisabled();
    expect(screen.getByLabelText('Write a note')).toBeInTheDocument();

    log.mockRestore();
  });
});
