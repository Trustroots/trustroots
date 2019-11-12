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
        label: t('Edit your profile'),
        link: '/profile/edit',
      },
    ];
  } else {
    links = [
      {
        label: t('Send a message'),
        link: `/messages/${username}`,
      },
    ];

    if (referencesEnabled) {
      links.push({
        label: t('Write a reference'),
        link: `/profile/${username}/references/new`,
      });
    }

    if (isResolved) {
      const contactLink = !contact._id
        ? {
            label: t('Add contact'),
            link: `/contact-add/${userId}`,
          }
        : contact.confirmed
        ? {
            label: t('Remove contact'),
            tooltip: t('Contacts since {{created, MMM DD, YYYY}}', {
              created: new Date(contact.created),
            }),
            onClick: () => setShowRemoveModal(true),
          }
        : {
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
            {links.map(({ label, link, tooltip, onClick }, index) => (
              <li key={index}>
                <NavButton
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

function LabelWithTooltip({ label, tooltip }) {
  return (
    <OverlayTrigger placement="bottom" overlay={<Tooltip>{tooltip}</Tooltip>}>
      <span>{label}</span>
    </OverlayTrigger>
  );
}

function NavButton({ label, link, tooltip, onClick }) {
  const labelWithTooltip = tooltip ? (
    <LabelWithTooltip label={label} tooltip={tooltip} />
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
  label: PropTypes.any.isRequired,
  link: PropTypes.string,
  tooltip: PropTypes.string,
  onClick: PropTypes.func,
};

LabelWithTooltip.propTypes = {
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string.isRequired,
};

TopNavigationSmall.propTypes = {
  username: PropTypes.string.isRequired,
  selfId: PropTypes.string.isRequired,
  userId: PropTypes.string.isRequired,
  contact: PropTypes.object.isRequired,
  referencesEnabled: PropTypes.bool.isRequired,
  isResolved: PropTypes.bool.isRequired,
  onContactRemoved: PropTypes.func.isRequired,
};
