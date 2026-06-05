import React from 'react';
import PropTypes from 'prop-types';

/**
 * Action-gate modal shown when a user tries to perform an action that requires
 * Nostroots (e.g. replying to a community note). Prompts the user to open the
 * Nostroots web app or dismiss.
 */
export default function NostrootsActionModal({ isOpen, onClose }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="nostroots-modal-backdrop"
      data-testid="modal-backdrop"
      onClick={onClose}
    >
      <div
        className="nostroots-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nostroots-modal-title"
      >
        <h2 className="nostroots-modal-title" id="nostroots-modal-title">
          Continue on Nostroots
        </h2>

        <div className="nostroots-modal-body">
          <p>
            Nostroots is the community-powered companion to Trustroots. Post
            travel tips, share local knowledge, and connect with travelers — all
            on a decentralized network where you own your data.
          </p>
        </div>

        <div className="nostroots-modal-actions">
          <a
            href="https://nos.trustroots.org"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-block"
          >
            Open Nostroots Web App
          </a>
        </div>

        <p className="nostroots-modal-note">
          Your Trustroots account works on Nostroots.
        </p>

        <button
          className="nostroots-modal-dismiss"
          onClick={onClose}
          type="button"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

NostrootsActionModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
