import React from 'react';
import PropTypes from 'prop-types';
import { withNamespaces } from 'react-i18next';
import { Modal } from 'react-bootstrap';

export function RemoveContact({ t, contact, show, inProgress, onHide, onRemoveContact, situation='confirmed' }) {

  // Different confirm button label and modal title depending on situation
  const situationLabels = {
    // User is cancelling a request they sent
    unconfirmedFromMe: {
      confirm: 'Yes, revoke request',
      title: 'Revoke contact request?',
      time: 'Requested'
    },
    // Decline received request
    unconfirmedToMe: {
      confirm: 'Yes, decline request',
      title: 'Decline contact request?',
      time: 'Requested'
    },
    // Removing confirmed contact
    confirmed: {
      confirm: 'Yes, remove contact',
      title: 'Remove contact?',
      time: 'Connected since'
    }
  };

  const labels = situationLabels[situation];

  return (
    <Modal show={show} onHide={onHide}>
      <div className="modal-content">
        <Modal.Header>
          <button type="button" className="close" aria-hidden="true" onClick={onHide} ng-if="!removeContactModal.isLoading">&times;</button>
          <Modal.Title>{t(labels.title)}</Modal.Title>
        </Modal.Header>

        <Modal.Body>

          <p>
            {t(`${labels.time} {{created, MMM D, YYYY}}`, { created: new Date(contact.created) })}
          </p>

        </Modal.Body>

        <Modal.Footer>
          <button className="btn btn-link" onClick={onHide} ng-disabled="removeContactModal.isLoading">Cancel</button>
          <button className="btn btn-primary" onClick={onRemoveContact} ng-disabled="removeContactModal.isLoading">
            {!inProgress && <span>{t(labels.confirm)}</span>}
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

export default withNamespaces('contact')(RemoveContact);
