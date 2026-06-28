import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminNotes from '@/modules/admin/client/components/AdminNotes';
import * as notesApi from '@/modules/admin/client/api/admin-notes.api';

jest.mock('@/modules/admin/client/api/admin-notes.api');
jest.mock('@/modules/core/client/components/TimeAgo', () => {
  const React = require('react');

  function MockTimeAgo({ date }) {
    return <time>{date.toISOString()}</time>;
  }

  MockTimeAgo.propTypes = {
    date: () => null,
  };

  return MockTimeAgo;
});
jest.mock('@/modules/core/client/components/TrEditor', () => {
  const React = require('react');

  function MockTrEditor({ onChange, onCtrlEnter, placeholder, text }) {
    return (
      <textarea
        aria-label={placeholder}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.ctrlKey && event.key === 'Enter') {
            onCtrlEnter();
          }
        }}
        value={text}
      />
    );
  }

  MockTrEditor.propTypes = {
    onChange: () => null,
    onCtrlEnter: () => null,
    placeholder: () => null,
    text: () => null,
  };

  return MockTrEditor;
});

const originalAlert = window.alert;

afterEach(() => {
  jest.clearAllMocks();
  window.alert = originalAlert;
});

const userId = '111111111111111111111111';

const makeNote = overrides => ({
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
    notesApi.listNotes.mockResolvedValueOnce([makeNote()]);

    render(<AdminNotes id={userId} />);

    expect(
      await screen.findByRole('link', { name: 'admin-alice (Admin Alice)' }),
    ).toHaveAttribute('href', '/admin/user?id=222222222222222222222222');
    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(notesApi.listNotes).toHaveBeenCalledWith(userId);
  });

  it('adds a note and refreshes the list', async () => {
    notesApi.listNotes
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeNote({ note: '<p>Fresh note</p>' })]);
    notesApi.addNote.mockResolvedValueOnce({});

    render(<AdminNotes id={userId} />);

    await waitFor(() => expect(notesApi.listNotes).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Write a note'), {
      target: { value: '<p>Fresh note</p>' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

    await waitFor(() =>
      expect(notesApi.addNote).toHaveBeenCalledWith({
        note: '<p>Fresh note</p>',
        userId,
      }),
    );
    expect(await screen.findByText('Fresh note')).toBeInTheDocument();
    expect(notesApi.listNotes).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Write a note')).toHaveValue('');
  });

  it('reports write failures and still refreshes notes', async () => {
    window.alert = jest.fn();
    notesApi.listNotes.mockResolvedValue([]);
    notesApi.addNote.mockRejectedValueOnce(new Error('write failed'));

    render(<AdminNotes id={userId} />);

    await waitFor(() => expect(notesApi.listNotes).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Write a note'), {
      target: { value: '<p>Broken note</p>' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(
        `Could not write admin notes for user ${userId}`,
      ),
    );
    expect(notesApi.listNotes).toHaveBeenCalledTimes(2);
  });

  it('logs failed note loads and leaves the editor usable', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    notesApi.listNotes.mockRejectedValueOnce(new Error('load failed'));

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
