import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import RemoveContact from '@/modules/contacts/client/components/RemoveContactContainer';

export default function TopNavigationSmall({
  username,
  contact,
  referencesEnabled,
  isResolved,
  selfId,
  userId,
  onContactRemoved,
}) {
  // @TODO this hacky fix should be removed and the data should be consistent
  if (contact) {
    if (typeof contact.userFrom === 'object') {
      contact.userFrom = contact.userFrom._id;
    }
    if (typeof contact.userTo === 'object') {
      contact.userTo = contact.userTo._id;
    }
  }

  const [showRemoveModal, setShowRemoveModal] = useState(false);

  const { t } = useTranslation('users');

  const isSelf = selfId === userId;

  let links;
  if (isSelf) {
    links = [
      {
        id: 'edit-profile',
        label: t('Edit your profile'),
        link: '/profile/edit',
      },
    ];
  } else {
    links = [
      {
        id: 'send-message',
        label: t('Send a message'),
        link: `/messages/${username}`,
      },
    ];

    if (referencesEnabled) {
      links.push({
        id: 'share-experience',
        label: t('Share your experience'),
        link: `/profile/${username}/experiences/new`,
      });
    }

    if (isResolved) {
      const contactLink = !contact._id
        ? {
            id: 'add-contact',
            label: t('Add contact'),
            link: `/contact-add/${userId}`,
          }
        : contact.confirmed
        ? {
            id: 'remove-contact',
            label: t('Remove contact'),
            onClick: () => setShowRemoveModal(true),
          }
        : {
            id: 'delete-contact-request',
            label: t('Delete contact request'),
            onClick: () => setShowRemoveModal(true),
          };

      links.push(contactLink);
    }
  }

  function handleRemoveSuccess() {
    setShowRemoveModal(false);

    // broadcast the removal to angular
    onContactRemoved(contact);
  }

  return (
    <>
      {contact && (
        <RemoveContact
          selfId={selfId}
          contact={contact}
          show={showRemoveModal}
          onSuccess={handleRemoveSuccess}
          onCancel={() => setShowRemoveModal(false)}
        />
      )}
      <nav className="navbar navbar-white navbar-fixed-top navbar-fixed-top-below visible-xs-block">
        <div className="container">
          <ul className="nav navbar-nav" role="navigation">
            {links.map(({ id, label, link, onClick }) => (
              <li key={id}>
                <a href={link} onClick={onClick}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}

TopNavigationSmall.propTypes = {
  username: PropTypes.string.isRequired,
  selfId: PropTypes.string.isRequired,
  userId: PropTypes.string.isRequired,
  contact: PropTypes.object,
  referencesEnabled: PropTypes.bool.isRequired,
  isResolved: PropTypes.bool.isRequired,
  onContactRemoved: PropTypes.func.isRequired,
};
