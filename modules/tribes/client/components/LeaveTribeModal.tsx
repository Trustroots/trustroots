import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Modal } from 'react-bootstrap';
import type { TribeSummary } from '../api/tribes.api';

export default function LeaveTribeModal({
  tribe,
  show,
  onConfirm,
  onCancel,
}: {
  tribe: TribeSummary;
  show: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('circles') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <Modal show={show} onHide={onCancel}>
      <div className="modal-content">
        <Modal.Header>
          <Modal.Title>{t('Leave this circle?') as string}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {
            t('Do you want to leave "{{label}}"?', {
              label: tribe.label,
            }) as string
          }
        </Modal.Body>

        <Modal.Footer>
          <button className="btn btn-primary" onClick={onConfirm}>
            {t('Leave circle') as string}
          </button>
          <button className="btn btn-default" onClick={onCancel}>
            {t('Cancel') as string}
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
