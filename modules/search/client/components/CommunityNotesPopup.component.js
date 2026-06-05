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
    <div className="community-notes-popup">
      {/* Header */}
      <div className="community-notes-popup__header">
        <span className="community-notes-popup__author">
          {profilePath ? (
            <a href={profilePath}>{authorLabel}</a>
          ) : (
            <span>{authorLabel}</span>
          )}
        </span>
        <span className="community-notes-popup__timestamp">
          {' · '}
          {timeAgo(createdAt)}
        </span>
        <span className="community-notes-popup__attribution">
          {' · via Nostroots'}
        </span>
      </div>

      {/* Verified indicator */}
      {verified && (
        <div className="community-notes-popup__verified">
          <span className="community-notes-popup__verified-icon">✓</span>
          <span className="community-notes-popup__verified-label">
            {' '}
            verified
          </span>
        </div>
      )}

      {/* Note content */}
      <p className="community-notes-popup__content">{content}</p>

      {/* Actions */}
      <div className="community-notes-popup__actions">
        {profilePath && (
          <a href={profilePath} className="community-notes-popup__action-link">
            View profile
          </a>
        )}
        <button
          className="community-notes-popup__action-link community-notes-popup__reply-btn"
          onClick={onActionGate}
          type="button"
        >
          Reply on Nostroots →
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
