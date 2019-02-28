import React from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import { Modal } from 'react-bootstrap';

export function RemoveContact({ t, contact, show, inProgress, onHide, onRemoveContact, situation='confirmed' }) {

  // parse contact.created to Date
  const created = new Date(contact.created);
  // Different confirm button label and modal title depending on situation
  const situationLabels = {
    // User is cancelling a request they sent
    unconfirmedFromMe: {
      confirm: t('Yes, revoke request'),
      title: t('Revoke contact request?'),
      time: t('Requested {{created, MMM D, YYYY}}', { created })
    },
    // Decline received request
    unconfirmedToMe: {
      confirm: t('Yes, decline request'),
      title: t('Decline contact request?'),
      time: t('Requested {{created, MMM D, YYYY}}', { created })
    },
    // Removing confirmed contact
    confirmed: {
      confirm: t('Yes, remove contact'),
      title: t('Remove contact?'),
      time: t('Connected since {{created, MMM D, YYYY}}', { created })
    }
  };

  const labels = situationLabels[situation];

  return (
    <Modal show={show} onHide={onHide}>
      <div className="modal-content">
        <Modal.Header>
          <button type="button" className="close" aria-hidden="true" onClick={onHide} ng-if="!removeContactModal.isLoading">&times;</button>
          <Modal.Title>{labels.title}</Modal.Title>
        </Modal.Header>

        <Modal.Body>

          <p>{labels.time}</p>

        </Modal.Body>

        <Modal.Footer>
          <button
            className="btn btn-link"
            onClick={onHide}
            disabled={inProgress}
          >{t('Cancel')}</button>
          <button
            className="btn btn-primary"
            onClick={onRemoveContact}
            disabled={inProgress}
          >
            {!inProgress && <span>{labels.confirm}</span>}
            {inProgress && <span
              role="alertdialog"
              aria-busy="true"
              aria-live="assertive">
              {t('Wait a moment...')}
            </span>}
          </button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}

RemoveContact.propTypes = {
  t: PropTypes.func.isRequired,
  contact: PropTypes.object.isRequired,
  show: PropTypes.bool.isRequired,
  inProgress: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onRemoveContact: PropTypes.func.isRequired,
  situation: PropTypes.string
};

export default withTranslation('contact')(RemoveContact);
