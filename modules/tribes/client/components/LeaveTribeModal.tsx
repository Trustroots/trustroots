import React from 'react';
import { Button } from '@trustroots/ui/Button';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@trustroots/ui/Modal';
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
    <Modal open={show} onClose={onCancel}>
      <ModalHeader>
        <ModalTitle>{t('Leave this circle?') as string}</ModalTitle>
      </ModalHeader>

      <ModalBody>
        {
          t('Do you want to leave "{{label}}"?', {
            label: tribe.label,
          }) as string
        }
      </ModalBody>

      <ModalFooter>
        <Button intent="primary" onClick={onConfirm}>
          {t('Leave circle') as string}
        </Button>
        <Button onClick={onCancel}>{t('Cancel') as string}</Button>
      </ModalFooter>
    </Modal>
  );
}
