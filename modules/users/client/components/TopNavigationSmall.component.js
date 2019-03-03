import React from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

export default function TopNavigationSmall({ isSelf, username, contact, areReferences, isResolved }) {

  let links;
  console.log('*********************************', isSelf, username, contact, areReferences, isResolved);

  if (isSelf) {
    links = [
      {
        label: 'Edit your profile',
        link: '/profile/edit'
      }
    ];
  } else {
    links = [
      {
        label: 'Send a message',
        link: `/messages/${username}`
      }
    ];

    if (areReferences) {
      links.push({
        label: 'Write a reference',
        link: `/profile/${username}/references/new`
      });
    }

    if (isResolved) {
      const contactLink = (!contact._id) ?
        {
          label: 'Add contact',
          link: `/messages/${username}`
        }
        :
        (contact.confirmed) ?
          {
            label: labelWithTooltip({ label: 'Remove contact', tooltip: 'Contacts since {{ ::profileCtrl.contact.created | date:\'mediumDate\''}),
            link: `/messages/${username}`,
            tooltip: 'Contacts since {{ ::profileCtrl.contact.created | date:\'mediumDate\''
          }
          :
          {
            label: 'Delete contact request',
            link: `/messages/${username}`,
            tooltip: 'Request sent {{ ::profileCtrl.contact.created | date:\'mediumDate\' }}'
          };

      links.push(contactLink);
    }
  }



  return (
    <nav className="navbar navbar-white navbar-fixed-top navbar-fixed-top-below visible-xs-block">
      <div className="container">
        <ul className="nav navbar-nav" role="navigation">
          {links.map(({ label, link }, index) => (
            <li key={index}><a href={link}>{label}</a></li>
          )
          )}
        </ul>
      </div>
    </nav>
  );
}

function labelWithTooltip({ label, tooltip }) {
  return (
    <OverlayTrigger
      placement="bottom"
      overlay={<Tooltip>{tooltip}</Tooltip>}
    >
        <span>{label}</span>
    </OverlayTrigger>
  );
}

TopNavigationSmall.propTypes = {
  isSelf: PropTypes.bool.isRequired,
  username: PropTypes.string.isRequired,
  contact: PropTypes.object.isRequired,
  areReferences: PropTypes.bool.isRequired,
  isResolved: PropTypes.bool.isRequired
};


/*
<!-- Top Navigation for small screens -->
<!-- When looking at own profile -->
<nav className="navbar navbar-white navbar-fixed-top navbar-fixed-top-below visible-xs-block"
     ng-if="app.user._id === profileCtrl.profile._id">
  <div className="container">
    <ul className="nav navbar-nav" role="navigation">
      <li><a ui-sref="profile-edit.about">Edit your profile</a></li>
    </ul>
  </div>
</nav>

<!-- Top Navigation for small screens -->
<!-- When looking at somebody else's profile -->
<nav className="navbar navbar-white navbar-fixed-top navbar-fixed-top-below visible-xs-block"
     ng-if="app.user._id !== profileCtrl.profile._id">
  <div className="container">
    <ul className="nav navbar-nav" role="toolbar" aria-label="Profile actions">
      <li>
        <a ui-sref="messageThread({username: profileCtrl.profile.username})">
          Send a message
        </a>
      </li>
      <li ng-if="app.appSettings.referencesEnabled">
        <a ui-sref="profile.references.new({username: profileCtrl.profile.username})">
          Write a reference
        </a>
      </li>
      <li>
        <a ui-sref="contactAdd({userId: profileCtrl.profile._id})"
           ng-if="profileCtrl.contact.$resolved && !profileCtrl.contact._id">
          Add contact
        </a>
        <a ng-if="profileCtrl.contact.$resolved && profileCtrl.contact._id"
           tr-contact-remove="profileCtrl.contact">
          <span ng-if="profileCtrl.contact.confirmed"
                uib-tooltip="Contacts since {{ ::profileCtrl.contact.created | date:'mediumDate' }}"
                tooltip-placement="bottom">
            Remove contact
          </span>
          <span ng-if="!profileCtrl.contact.confirmed"
                uib-tooltip="Request sent {{ ::profileCtrl.contact.created | date:'mediumDate' }}"
                tooltip-placement="bottom">
            Delete contact request
          </span>
        </a>
      </li>
    </ul>
  </div>
</nav>
*/
