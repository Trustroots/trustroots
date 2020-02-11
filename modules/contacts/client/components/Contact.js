import React, { useState } from 'react';
import PropTypes from 'prop-types';
import ContactPresentational from './ContactPresentational';
import RemoveContact from './RemoveContactContainer';

export default function Contact({
  className,
  contact,
  avatarSize,
  selfId,
  hideMeta,
  onContactRemoved = () => {},
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

Contact.propTypes = {
  className: PropTypes.string,
  contact: PropTypes.object.isRequired,
  avatarSize: PropTypes.number,
  selfId: PropTypes.string.isRequired,
  hideMeta: PropTypes.bool,
  // this is a function provided from Angular. It broadcasts the information that a contact was removed.
  // @TODO this won't be needed when migration is finished
  onContactRemoved: PropTypes.func,
};

function getSituation(contact, selfId) {
  return (
    (contact.confirmed === false &&
      contact.userFrom === selfId &&
      'unconfirmedFromMe') ||
    (contact.confirmed === false &&
      contact.userTo === selfId &&
      'unconfirmedToMe') ||
    'confirmed'
  );
}
