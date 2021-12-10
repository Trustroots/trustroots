import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Modal } from 'react-bootstrap';

export default function RemoveContact({
  contact,
  show,
  inProgress,
  selfId,
  onRemove,
  onCancel,
}) {
  const { t } = useTranslation('contacts');

  // modal title, label for confirmation button, creation information
  // depends on whether contact is confirmed and who sent the request
  let labelTitle;
  let labelConfirm;
  let labelTime;

  const isFromMe = contact.userFrom === selfId;
  const isConfirmed = contact.confirmed;
  const date = new Date(contact.created);

  if (isConfirmed) {
    // Remove confirmed contact
    labelTitle = t('Remove contact?');
    labelConfirm = t('Yes, remove contact');
    labelTime = t('Connected since {{date, LL}}', { date });
  } else if (isFromMe) {
    // Revoke contact request
    labelTitle = t('Revoke contact request?');
    labelConfirm = t('Yes, revoke request');
    labelTime = t('Requested {{date, LL}}', { date });
  } else {
    // Decline received contact request
    labelTitle = t('Decline contact request?');
    labelConfirm = t('Yes, decline request');
    labelTime = t('Requested {{date, LL}}', { date });
  }

  return (
    <Modal show={show} onHide={onCancel}>
      <div className="modal-content">
        <Modal.Header>
          {!inProgress && (
            <button
              type="button"
              className="close"
              aria-hidden="true"
              onClick={onCancel}
            >
              &times;
            </button>
          )}
          <Modal.Title>{labelTitle}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p>{labelTime}</p>
        </Modal.Body>

        <Modal.Footer>
          <button
            className="btn btn-link"
            onClick={onCancel}
            disabled={inProgress}
          >
            {t('Cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={onRemove}
            disabled={inProgress}
          >
            {!inProgress && <span>{labelConfirm}</span>}
            {inProgress && (
              <span role="alertdialog" aria-busy="true" aria-live="assertive">
                {t('Wait a moment…')}
              </span>
            )}
          </button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}

RemoveContact.propTypes = {
  contact: PropTypes.object.isRequired,
  show: PropTypes.bool.isRequired,
  inProgress: PropTypes.bool.isRequired,
  selfId: PropTypes.string.isRequired,
  onCancel: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};
