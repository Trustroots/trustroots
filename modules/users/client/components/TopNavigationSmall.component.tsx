import React, { useState } from 'react';
import { rememberOutreachSource } from '@trustroots/analytics/client';
import { getAdminUserHref } from '@/modules/core/client/utils/admin-member-link';
import { useTranslation } from 'react-i18next';
import type { ExperienceAction } from '../profile-experiences';
import type { ProfileContact, ProfileContacts } from '../profile-contacts';

interface TopNavigationSmallProps {
  RemoveContact: ProfileContacts['Remove'];
  isAdmin?: boolean;
  username: string;
  contact?: ProfileContact | null;
  experienceAction?: ExperienceAction;
  isResolved: boolean;
  selfId: string;
  userId: string;
  onContactRemoved: (contact: ProfileContact) => void;
}

interface NavigationLink {
  id: string;
  label: string;
  link?: string;
  onClick?: () => void;
}

export default function TopNavigationSmall({
  RemoveContact,
  isAdmin = false,
  username,
  contact,
  experienceAction,
  isResolved,
  selfId,
  userId,
  onContactRemoved,
}: TopNavigationSmallProps) {
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

  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  const isSelf = selfId === userId;

  let links: NavigationLink[];
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
        onClick: () => rememberOutreachSource(username, 'profile'),
      },
    ];

    if (experienceAction) {
      links.push({
        id: 'share-experience',
        label: experienceAction.label,
        link: experienceAction.href,
      });
    }

    if (isResolved && contact) {
      const contactLink = !contact._id
        ? {
            id: 'add-contact',
            label: t('Add contact'),
            link: `/contact-add/${userId}`,
            onClick: () => rememberOutreachSource(username, 'profile'),
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

  if (isAdmin && userId) {
    links.push({
      id: 'admin',
      label: 'Admin',
      link: getAdminUserHref({ _id: userId, username }),
    });
  }

  function handleRemoveSuccess() {
    setShowRemoveModal(false);

    // Notify the parent about the removal.
    onContactRemoved(contact as ProfileContact);
  }

  return (
    <>
      {contact?._id && (
        <RemoveContact
          selfId={selfId}
          contact={contact as ProfileContact & { _id: string }}
          show={showRemoveModal}
          onSuccess={handleRemoveSuccess}
          onCancel={() => setShowRemoveModal(false)}
        />
      )}
      <nav className="navbar navbar-white navbar-fixed-top navbar-fixed-top-below tw:block tw:sm:hidden">
        <div className="tw:page-container tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:px-0">
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
