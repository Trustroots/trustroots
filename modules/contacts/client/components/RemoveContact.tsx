import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@trustroots/ui/Modal';
import type { ContactRecord } from '../types';

export default function RemoveContact({
  contact,
  show,
  inProgress,
  selfId,
  onRemove,
  onCancel,
}: {
  contact: ContactRecord;
  show: boolean;
  inProgress: boolean;
  selfId: string;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('contacts') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  // modal title, label for confirmation button, creation information
  // depends on whether contact is confirmed and who sent the request
  let labelTitle;
  let labelConfirm;
  let labelTime;

  const isFromMe = contact.userFrom === selfId;
  const isConfirmed = contact.confirmed;
  const date = new Date(contact.created || '');

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
    <Modal open={show} onClose={onCancel}>
      <ModalHeader closeLabel={inProgress ? undefined : t('Close')}>
        <ModalTitle>{labelTitle}</ModalTitle>
      </ModalHeader>

      <ModalBody>
        <p>{labelTime}</p>
      </ModalBody>

      <ModalFooter>
        <Button variant="link" onClick={onCancel} disabled={inProgress}>
          {t('Cancel') as string}
        </Button>
        <Button intent="primary" onClick={onRemove} disabled={inProgress}>
          {!inProgress && <span>{labelConfirm}</span>}
          {inProgress && (
            <span role="alertdialog" aria-busy="true" aria-live="assertive">
              {t('Wait a moment…') as string}
            </span>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
