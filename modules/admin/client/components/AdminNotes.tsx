import RichText from '@/modules/core/client/components/RichText';
// External dependencies
import React, { useEffect, useState } from 'react';

import * as api from '../api/admin-notes.api';
import TrEditor from '@/modules/core/client/components/TrEditor';
import UserLink from './UserLink.component';
import { formatAdminDateTime } from '../utils/admin-date';
import { Button } from '@trustroots/ui/Button';

interface AdminNote {
  _id: string;
  admin?: { _id?: string; username?: string; displayName?: string };
  note: string;
  date: string;
}

interface TrEditorProps {
  className?: string;
  onChange: (value: string) => void;
  onCtrlEnter: () => void | Promise<void>;
  placeholder: string;
  text: string;
}

const TypedTrEditor = TrEditor as unknown as React.ComponentType<TrEditorProps>;

/**
 * Lists notes about user and allows writing notes about them
 */
export default function AdminNotes({
  id,
  refreshToken,
}: {
  id: string;
  refreshToken?: number;
}) {
  const [isFetching, setIsFetching] = useState(false);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [newNote, setNewNote] = useState('');

  async function fetchNotes() {
    setIsFetching(true);
    try {
      const notes = await api.listNotes(id);
      setNotes(notes);
    } catch {
      // eslint-disable-next-line no-console
      console.log(`Could not load safety notes for user ${id}`);
    } finally {
      setIsFetching(false);
    }
  }

  useEffect(() => {
    fetchNotes();
  }, [id, refreshToken]);

  const addNote = async () => {
    try {
      await api.addNote({
        note: newNote,
        userId: id,
      });
    } catch {
      alert(`Could not write safety notes for user ${id}`);
    } finally {
      setNewNote('');
      fetchNotes();
    }
  };

  return (
    <>
      <h4 id="notes">
        <a href="#notes">Safety notes about user</a>
      </h4>
      <div className="panel panel-default admin-notes">
        <div className="panel-body">
          <TypedTrEditor
            className="admin-notes-field"
            onChange={value => setNewNote(value)}
            onCtrlEnter={addNote}
            placeholder="Write a note"
            text={newNote}
          />
          <Button disabled={isFetching || !newNote} onClick={addNote}>
            Save note
          </Button>
          {isFetching && <p>Loading notes...</p>}
          {!isFetching &&
            notes &&
            notes.length > 0 &&
            notes.map(({ _id, admin, note, date }) => {
              return (
                <div key={_id} className="admin-note">
                  <p className="text-muted">
                    <time dateTime={date}>{formatAdminDateTime(date)}</time>
                    {' by '}
                    <UserLink user={admin} />
                  </p>
                  <RichText content={note} />
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}
