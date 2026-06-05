import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import NostrService from '../services/nostr.client.service';
import NostrootsActionModal from '@/modules/core/client/components/NostrootsActionModal.component';

const nostrService = new NostrService('wss://relay.trustroots.org');

function timeAgo(timestamp) {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
  return new Date(timestamp * 1000).toLocaleDateString();
}

/**
 * Sidebar panel showing a thread of community notes for a plus code location.
 * Displayed when a community note pin is clicked on the map.
 */
export default function CommunityNotesSidebar({ notes, plusCode, onClose }) {
  const [showModal, setShowModal] = useState(false);
  const [usernames, setUsernames] = useState({});

  // Resolve usernames for all note authors
  useEffect(() => {
    if (!notes || notes.length === 0) return;

    const pubkeys = [...new Set(notes.map(n => n.pubkey))];
    pubkeys.forEach(pubkey => {
      nostrService.resolveNpubToUsername(pubkey).then(name => {
        if (name) {
          setUsernames(prev => ({ ...prev, [pubkey]: name }));
        }
      });
    });
  }, [notes]);

  if (!notes || notes.length === 0) return null;

  const sorted = [...notes].sort((a, b) => b.created_at - a.created_at);

  return (
    <div className="community-notes-sidebar">
      <div className="community-notes-sidebar-header">
        <h4 className="community-notes-sidebar-title">Community Notes</h4>
        <small className="text-muted community-notes-sidebar-location">
          {plusCode}
        </small>
      </div>

      <div className="community-notes-sidebar-thread">
        {sorted.map(note => {
          const username = usernames[note.pubkey];
          return (
            <div key={note.id} className="community-notes-sidebar-note">
              <div className="community-notes-sidebar-note-header">
                {username ? (
                  <a
                    href={'/profile/' + username}
                    className="community-notes-sidebar-author"
                  >
                    {username}
                  </a>
                ) : (
                  <span className="community-notes-sidebar-author text-muted">
                    {note.pubkey.substring(0, 12)}...
                  </span>
                )}
                <span className="text-muted">{timeAgo(note.created_at)}</span>
              </div>
              <p className="community-notes-sidebar-note-content">
                {note.content}
              </p>
            </div>
          );
        })}
      </div>

      <div className="community-notes-sidebar-actions">
        <button
          className="btn btn-sm btn-primary"
          onClick={() => setShowModal(true)}
        >
          Reply on Nostroots
        </button>
        <span className="text-muted community-notes-sidebar-via">
          via Nostroots
        </span>
      </div>

      <NostrootsActionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}

CommunityNotesSidebar.propTypes = {
  notes: PropTypes.array,
  plusCode: PropTypes.string,
  onClose: PropTypes.func,
};
