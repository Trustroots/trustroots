// External dependencies
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import * as api from '../api/admin-notes.api';
import TrEditor from '@/modules/core/client/components/TrEditor';
import TimeAgo from '@/modules/core/client/components/TimeAgo';
import UserLink from './UserLink.component';

/**
 * Lists notes about user and allows writing notes about them
 */
export default function AdminNotes({ id }) {
  const [isFetching, setIsFetching] = useState(false);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');

  async function fetchNotes() {
    setIsFetching(true);
    try {
      const notes = await api.listNotes(id);
      setNotes(notes);
    } catch {
      // eslint-disable-next-line no-console
      console.log(`Could not load admin notes for user ${id}`);
    } finally {
      setIsFetching(false);
    }
  }

  useEffect(() => {
    fetchNotes();
  }, []);

  const addNote = async () => {
    try {
      await api.addNote({
        note: newNote,
        userId: id,
      });
    } catch {
      alert(`Could not write admin notes for user ${id}`);
    } finally {
      setNewNote('');
      fetchNotes();
    }
  };

  return (
    <>
      <h4 id="notes">
        Admin notes about user
        <a href="#notes" className="btn btn-link">
          #
        </a>
      </h4>
      <div className="panel panel-default admin-notes">
        <div className="panel-body">
          <TrEditor
            className="admin-notes-field"
            onChange={value => setNewNote(value)}
            onCtrlEnter={addNote}
            placeholder="Write a note"
            text={newNote}
          />
          <button
            className="btn btn-default"
            disabled={isFetching || !newNote}
            onClick={addNote}
          >
            Save note
          </button>
          {isFetching && <p>Loading notes...</p>}
          {!isFetching &&
            notes &&
            notes.length > 0 &&
            notes.map(({ _id, admin, note, date }) => {
              return (
                <div key={_id} className="admin-note">
                  <p className="text-muted">
                    <TimeAgo date={new Date(date)} />
                    {' by '}
                    <UserLink user={admin} />
                  </p>
                  <div dangerouslySetInnerHTML={{ __html: note }} />
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}

AdminNotes.propTypes = {
  id: PropTypes.string.isRequired,
};
