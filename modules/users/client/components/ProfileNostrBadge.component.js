import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { nostrService } from '@/modules/search/client/services/nostr.client.service';
import { timeAgo } from '@/modules/search/client/utils/time-ago';
import NostrootsActionModal from '@/modules/core/client/components/NostrootsActionModal.component';

export default function ProfileNostrBadge({ npubHex }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!npubHex) return;

    let cancelled = false;
    setLoading(true);

    nostrService
      .fetchUserNotes(npubHex)
      .then(fetchedNotes => {
        if (!cancelled) {
          setNotes(fetchedNotes);
        }
      })
      .catch(() => {
        // silently ignore fetch errors
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [npubHex]);

  if (!npubHex) return null;
  if (!loading && notes.length === 0) return null;

  return (
    <div>
      <span className="profile-nostr-badge">Nostroots</span>

      {notes.length > 0 && (
        <div className="profile-nostr-notes">
          <h4 className="profile-nostr-notes-title">Recent community notes</h4>
          {notes.map(note => (
            <div key={note.id} className="profile-nostr-note">
              <p className="profile-nostr-note-content">{note.content}</p>
              <small className="profile-nostr-note-meta text-muted">
                {timeAgo(note.created_at)}
              </small>
            </div>
          ))}
          <button
            type="button"
            className="profile-nostr-notes-more"
            onClick={() => setModalOpen(true)}
          >
            See all notes on Nostroots &rarr;
          </button>
        </div>
      )}

      <NostrootsActionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

ProfileNostrBadge.propTypes = {
  npubHex: PropTypes.string,
};

ProfileNostrBadge.defaultProps = {
  npubHex: null,
};
