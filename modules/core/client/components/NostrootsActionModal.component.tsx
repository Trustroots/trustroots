import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { getCurrentUser } from '../services/client-runtime';
import NostrootsOnboarding from './NostrootsOnboarding.component';

/**
 * Action-gate modal shown when a user tries to perform an action that requires
 * Nostroots (e.g. replying to a community note). Prompts the user to open the
 * Nostroots onboarding or use an existing browser/store alternative.
 */
type Props = {
  isOpen: boolean;
  onClose: () => void;
  plusCode?: string | null;
  source?: 'community-notes' | 'profile-notes';
};
export default function NostrootsActionModal({
  isOpen,
  onClose,
  plusCode,
  source = 'community-notes',
}: Props) {
  const { t } = useTranslation('core');
  const ctaRef = useRef<HTMLAnchorElement>(null);

  const webAppUrl = plusCode
    ? `https://nos.trustroots.org/v0/#${plusCode}`
    : 'https://nos.trustroots.org';

  useEffect(() => {
    if (!isOpen) return;

    // Focus the CTA when the modal opens
    /* istanbul ignore else: the CTA ref is populated by React when rendered. */
    if (ctaRef.current) {
      ctaRef.current.focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nostroots-modal-title"
      >
        <button
          className="nostroots-modal-close"
          onClick={onClose}
          type="button"
          aria-label={t('Close')}
        >
          &times;
        </button>

        <h2 className="nostroots-modal-title" id="nostroots-modal-title">
          {t('Get Nostroots')}
        </h2>

        <NostrootsOnboarding
          username={getCurrentUser()?.username}
          source={source}
          linkRef={ctaRef}
        />

        <div className="nostroots-modal-actions">
          <a
            href="https://apps.apple.com/us/app/nostroots/id6755037304"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-default btn-block nostroots-modal-btn"
          >
            {t('Download for iOS')}
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=org.trustroots.nostroots"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-default btn-block nostroots-modal-btn"
          >
            {t('Download for Android')}
          </a>
          <a
            href={webAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-default btn-block nostroots-modal-btn"
          >
            {t('Open web app')}
          </a>
        </div>

        <button
          className="nostroots-modal-dismiss"
          onClick={onClose}
          type="button"
        >
          {t('Not now')}
        </button>
      </div>
    </div>
  );
}

NostrootsActionModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  plusCode: PropTypes.string,
  source: PropTypes.oneOf(['community-notes', 'profile-notes']),
};
