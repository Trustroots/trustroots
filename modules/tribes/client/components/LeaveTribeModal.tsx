import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from 'react-bootstrap';
import { Button } from '@trustroots/ui';
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
          <Button variant="primary" onClick={onConfirm}>
            {t('Leave circle') as string}
          </Button>
          <Button variant="default" onClick={onCancel}>
            {t('Cancel') as string}
          </Button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}
