import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import RemoveContact from '../../../contacts/client/components/RemoveContactContainer';

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

  const { t } = useTranslation('user');

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
        id: 'write-reference',
        label: t('Write a reference'),
        link: `/profile/${username}/references/new`,
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
            tooltip: t('Contacts since {{created, MMM DD, YYYY}}', {
              created: new Date(contact.created),
            }),
            onClick: () => setShowRemoveModal(true),
          }
        : {
            id: 'delete-contact-request',
            label: t('Delete contact request'),
            tooltip: t('Request sent {{created, MMM DD, YYYY}}', {
              created: new Date(contact.created),
            }),
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
            {links.map(({ id, label, link, tooltip, onClick }) => (
              <li key={id}>
                <NavButton
                  id={id}
                  label={label}
                  link={link}
                  tooltip={tooltip}
                  onClick={onClick}
                />
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}

function LabelWithTooltip({ id, label, tooltip }) {
  return (
    <OverlayTrigger
      placement="bottom"
      overlay={<Tooltip id={`tooltip-${id}`}>{tooltip}</Tooltip>}
    >
      <span>{label}</span>
    </OverlayTrigger>
  );
}

function NavButton({ id, label, link, tooltip, onClick }) {
  const labelWithTooltip = tooltip ? (
    <LabelWithTooltip id={id} label={label} tooltip={tooltip} />
  ) : (
    label
  );

  return link ? (
    <a href={link}>{labelWithTooltip}</a>
  ) : (
    <a onClick={onClick}>{labelWithTooltip}</a>
  );
}

NavButton.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.any.isRequired,
  link: PropTypes.string,
  tooltip: PropTypes.string,
  onClick: PropTypes.func,
};

LabelWithTooltip.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string.isRequired,
};

TopNavigationSmall.propTypes = {
  username: PropTypes.string.isRequired,
  selfId: PropTypes.string.isRequired,
  userId: PropTypes.string.isRequired,
  contact: PropTypes.object,
  referencesEnabled: PropTypes.bool.isRequired,
  isResolved: PropTypes.bool.isRequired,
  onContactRemoved: PropTypes.func.isRequired,
};
