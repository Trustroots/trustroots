import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Modal } from 'react-bootstrap';

export default function LeaveTribeModal({ tribe, show, onConfirm, onCancel }) {
  const { t } = useTranslation('circles');

  return (
    <Modal show={show} onHide={onCancel}>
      <div className="modal-content">
        <Modal.Header>
          <Modal.Title>{t('Leave this circle?')}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {t('Do you want to leave "{{label}}"?', { label: tribe.label })}
        </Modal.Body>

        <Modal.Footer>
          <button className="btn btn-primary" onClick={onConfirm}>
            {t('Leave circle')}
          </button>
          <button className="btn btn-default" onClick={onCancel}>
            {t('Cancel')}
          </button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}

LeaveTribeModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  tribe: PropTypes.object.isRequired,
};
