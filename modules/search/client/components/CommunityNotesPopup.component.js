import React from 'react';
import PropTypes from 'prop-types';

/**
 * Convert a Unix timestamp to a relative time string.
 *
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Relative time (e.g. "5m ago", "3h ago", "2d ago") or
 *   a locale date string for older events.
 */
export function timeAgo(timestamp) {
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

/**
 * Truncate a hex pubkey to a short display form.
 *
 * @param {string} pubkey - Full hex pubkey
 * @returns {string} e.g. "npub:abcd…ef12"
 */
function truncatePubkey(pubkey) {
  if (!pubkey || pubkey.length < 12) return pubkey || '';
  return `${pubkey.slice(0, 6)}…${pubkey.slice(-4)}`;
}

/**
 * Popup shown when a community-notes pin is clicked on the map.
 */
export default function CommunityNotesPopup({
  content,
  pubkey,
  createdAt,
  verified,
  username,
  onActionGate,
}) {
  const profilePath = username ? `/profile/${username}` : null;
  const authorLabel = username || truncatePubkey(pubkey);

  return (
    <div className="community-note-popup">
      <div className="community-note-popup-header">
        <span className="community-note-author">
          {profilePath ? (
            <a href={profilePath}>{authorLabel}</a>
          ) : (
            <span>{authorLabel}</span>
          )}
          <span className="community-note-meta">
            {' \u00b7 '}
            {timeAgo(createdAt)}
            {' \u00b7 via Nostroots'}
          </span>
        </span>
        {verified && (
          <span className="community-note-verified">{'✓ verified'}</span>
        )}
      </div>

      <p className="community-note-popup-content">{content}</p>

      <div className="community-note-popup-actions">
        {profilePath && (
          <a href={profilePath} className="community-note-popup-action">
            View profile
          </a>
        )}
        <button
          className="community-note-popup-action community-note-popup-reply"
          onClick={onActionGate}
          type="button"
        >
          Reply &rarr;
        </button>
      </div>
    </div>
  );
}

CommunityNotesPopup.propTypes = {
  content: PropTypes.string.isRequired,
  pubkey: PropTypes.string.isRequired,
  createdAt: PropTypes.number.isRequired,
  verified: PropTypes.bool,
  username: PropTypes.string,
  onActionGate: PropTypes.func.isRequired,
};

CommunityNotesPopup.defaultProps = {
  verified: false,
  username: null,
};
