import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@trustroots/ui/Alert';
import { Button, type ButtonProps } from '@trustroots/ui/Button';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@trustroots/ui/Modal';

import { couchsurfingProfileLink } from '../utils/networks';

export default function CouchsurfingProfileAction({
  handle,
  children,
  ...triggerProps
}: Pick<ButtonProps, 'className' | 'intent' | 'variant'> & {
  handle: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation(['users', 'core']);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <Button
        {...triggerProps}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <Modal open={open} onClose={close}>
        <ModalHeader>
          <ModalTitle>{t('Continue to Couchsurfing?')}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <Alert intent="warning" role="alert" className="tw:mb-0">
            {t(
              'Couchsurfing is run by a for-profit company that merely wants to extract value from its users without caring about privacy or community.',
            )}
          </Alert>
        </ModalBody>
        <ModalFooter>
          <Button type="button" onClick={close}>
            {t('Cancel', { ns: 'core' })}
          </Button>
          <Button
            intent="primary"
            render={
              <a
                href={couchsurfingProfileLink(handle)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
              />
            }
          >
            {t('Open Couchsurfing in a new tab')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
