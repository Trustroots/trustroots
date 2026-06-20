import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { nostrService } from '../services/nostr.client.service';
import { timeAgo } from '../utils/time-ago';
import NostrootsActionModal from '@/modules/core/client/components/NostrootsActionModal.component';

/**
 * Sidebar panel showing a thread of community notes for a plus code location.
 * Displayed when a community note pin is clicked on the map.
 */
export default function CommunityNotesSidebar({ notes, plusCode }) {
  const [showModal, setShowModal] = useState(false);
  const [usernames, setUsernames] = useState({});
  const [resolving, setResolving] = useState(false);

  // Resolve usernames for all note authors
  useEffect(() => {
    let cancelled = false;

    if (!notes || notes.length === 0) {
      setUsernames({});
      setResolving(false);
      return;
    }

    const pubkeys = [
      ...new Set(notes.map(n => n.authorPubkey || n.pubkey).filter(Boolean)),
    ];
    setUsernames({});

    if (pubkeys.length === 0) {
      setResolving(false);
      return;
    }

    setResolving(true);
    let remaining = pubkeys.length;

    pubkeys.forEach(pubkey => {
      nostrService
        .resolveNpubToUsername(pubkey)
        .then(name => {
          if (!cancelled && name) {
            setUsernames(prev => ({ ...prev, [pubkey]: name }));
          }
        })
        .catch(() => {})
        .finally(() => {
          if (cancelled) {
            return;
          }
          remaining -= 1;
          if (remaining <= 0) setResolving(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [notes]);

  if (!notes || notes.length === 0) return null;

  const sorted = [...notes].sort((a, b) => b.created_at - a.created_at);

  return (
    <div className="community-notes-sidebar">
      <div className="community-notes-sidebar-header">
        <h4 className="community-notes-sidebar-title">
          Community Notes
          <span className="community-notes-sidebar-count">{sorted.length}</span>
        </h4>
        <small className="text-muted community-notes-sidebar-location">
          {plusCode}
        </small>
      </div>

      <div className="community-notes-sidebar-thread">
        {sorted.map(note => {
          const authorPubkey = note.authorPubkey || note.pubkey;
          const username = usernames[authorPubkey];
          const showSkeleton = resolving && !username;
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
                  <span
                    className={
                      'community-notes-sidebar-author text-muted' +
                      (showSkeleton
                        ? ' community-notes-sidebar-author-loading'
                        : '')
                    }
                  >
                    {authorPubkey.substring(0, 12)}...
                  </span>
                )}
                <span className="community-notes-sidebar-time text-muted">
                  {timeAgo(note.created_at)}
                </span>
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
          Reply
        </button>
        <span className="text-muted community-notes-sidebar-via">
          via Nostroots
        </span>
      </div>

      <NostrootsActionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        plusCode={plusCode}
      />
    </div>
  );
}

CommunityNotesSidebar.propTypes = {
  notes: PropTypes.array,
  plusCode: PropTypes.string,
};
