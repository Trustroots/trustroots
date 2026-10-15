import React, { useState } from 'react';
import ContactPresentational from './ContactPresentational';
import RemoveContact from './RemoveContactContainer';
import type { ContactListEntry } from '../types';

export default function Contact({
  className,
  contact,
  avatarSize,
  selfId,
  hideMeta,
  onContactRemoved = () => {},
}: {
  className?: string;
  contact: ContactListEntry;
  avatarSize?: number;
  selfId: string;
  hideMeta?: boolean;
  onContactRemoved?: () => void;
}) {
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  const situation = getSituation(contact, selfId);

  function handleRemoveContact() {
    setShowRemoveModal(false);
    onContactRemoved();
  }

  return (
    <>
      <RemoveContact
        contact={contact}
        show={showRemoveModal}
        onCancel={() => setShowRemoveModal(false)}
        onSuccess={handleRemoveContact}
        selfId={selfId}
      />
      <ContactPresentational
        className={className}
        contact={contact}
        avatarSize={avatarSize}
        hideMeta={hideMeta}
        situation={situation}
        onClickRemove={() => setShowRemoveModal(true)}
      />
    </>
  );
}

function getSituation(contact: ContactListEntry, selfId: string) {
  const userFrom =
    typeof contact.userFrom === 'string'
      ? contact.userFrom
      : contact.userFrom?._id;
  const userTo =
    typeof contact.userTo === 'string' ? contact.userTo : contact.userTo?._id;
  return (
    (contact.confirmed === false &&
      userFrom === selfId &&
      'unconfirmedFromMe') ||
    (contact.confirmed === false && userTo === selfId && 'unconfirmedToMe') ||
    'confirmed'
  );
}
