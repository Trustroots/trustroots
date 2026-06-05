import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import NostrService from '@/modules/search/client/services/nostr.client.service';
import NostrootsActionModal from '@/modules/core/client/components/NostrootsActionModal.component';

const nostrService = new NostrService(
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'ws://localhost:7000'
    : 'wss://relay.trustroots.org',
);

/**
 * Convert a Unix timestamp to a relative time string.
 */
function timeAgo(timestamp) {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 3600) {
    return `${Math.max(1, Math.floor(diff / 60))}m ago`;
  }
  if (diff < 86400) {
    return `${Math.floor(diff / 3600)}h ago`;
  }
  if (diff < 86400 * 30) {
    return `${Math.floor(diff / 86400)}d ago`;
  }
  return new Date(timestamp * 1000).toLocaleDateString();
}

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
    <div className="profile-nostr-badge">
      <span>Nostroots</span>

      {notes.length > 0 && (
        <div>
          <h4 className="profile-nostr-notes-title">Recent community notes</h4>
          {notes.map(note => (
            <div key={note.id} className="profile-nostr-note">
              <p>{note.content}</p>
              <small>{timeAgo(note.created_at)}</small>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-link"
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
