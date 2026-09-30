import React, { useState } from 'react';
import PropTypes from 'prop-types';
import RemoveContact from './RemoveContact';
import * as contacts from '../api/contacts.api';
import type { ContactRecord } from '../types';
const api = { contacts };

export default function RemoveContactContainer({
  selfId,
  contact,
  show,
  onSuccess,
  onCancel,
}: {
  selfId: string;
  contact: ContactRecord & { _id: string };
  show: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    await api.contacts.remove(contact._id);
    setRemoving(false);
    onSuccess();
  }

  return (
    <RemoveContact
      contact={contact}
      selfId={selfId}
      show={show}
      inProgress={removing}
      onRemove={handleRemove}
      onCancel={onCancel}
    />
  );
}

RemoveContactContainer.propTypes = {
  selfId: PropTypes.string.isRequired,
  contact: PropTypes.object.isRequired,
  show: PropTypes.bool.isRequired,
  onSuccess: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
