// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import { Navbar, NavDropdown, Nav, Dropdown } from 'react-bootstrap';

// Internal dependencies
import { userType } from '@/modules/users/client/users.prop-types';
import Avatar from '@/modules/users/client/components/Avatar.component.js';
import UnreadCount from '@/modules/messages/client/components/UnreadCount.component';
import Icon from './Icon';
import MenuItem from './NavigationMenuItem';
import SubMenuList from './NavigationSubMenuList';

export default function NavigationLoggedIn({ currentPath, onSignout, user }) {
  const { t } = useTranslation('core');

  return (
    <div className="container">
      <div className="navbar-header">
        <Navbar.Brand as="div">
          <a href="/" className="hidden-xs" aria-hidden="true">
            <img
              className="hidden-xs hidden-sm"
              src="/img/logo/horizontal-white.svg"
              alt="Trustroots"
              width="177"
              height="31"
            />
            <img
              className="hidden-md hidden-lg"
              src="/img/tree-white.svg"
              alt="Trustroots"
              width="31"
              height="31"
            />
          </a>
        </Navbar.Brand>
      </div>

      <Nav as="ul" className="hidden-xs">
        <NavDropdown
          as="li"
          renderMenuOnMount
          className="hidden-xs cursor-pointer"
          id="support-dropdown"
          title={t('Support')}
        >
          <Dropdown.Item href="/faq">
            {t('Frequently Asked Questions')}
          </Dropdown.Item>
          <Dropdown.Item href="/safety">{t('Safety')}</Dropdown.Item>
          <Dropdown.Item href="/faq/bugs-and-features">
            {t('Report a bug')}
          </Dropdown.Item>
          <Dropdown.Item href="/support">{t('Contact us')}</Dropdown.Item>
        </NavDropdown>
      </Nav>

      <Nav as="ul" className="nav-header-primary">
        <MenuItem
          currentPath={currentPath}
          path="/circles"
          aria-label={t('Circles')}
        >
          <Icon
            className="visible-xs-block"
            fixedWidth
            icon="tribes"
            size="lg"
          />
          <span className="hidden-xs">{t('Circles')}</span>
        </MenuItem>
        <MenuItem
          currentPath={currentPath}
          path="/search"
          aria-label={t('Search hosts')}
        >
          <Icon
            className="visible-xs-block"
            fixedWidth
            icon="search"
            size="lg"
          />
          <span className="hidden-xs">{t('Search')}</span>
        </MenuItem>
        <MenuItem
          currentPath={currentPath}
          path="/messages"
          aria-label={t('Messages')}
        >
          <Icon
            className="visible-xs-block"
            fixedWidth
            icon="messages"
            size="lg"
          />
          <span className="hidden-xs">{t('Messages')}</span>
          <UnreadCount />
        </MenuItem>
        <MenuItem
          currentPath={currentPath}
          path="/offer/host"
          className="hidden-xs"
        >
          {t('Host')}
        </MenuItem>
        <MenuItem
          currentPath={currentPath}
          path="https://nos.trustroots.org/"
          target="_blank"
          className="hidden-xs"
        >
          Nostroots
        </MenuItem>
        <NavDropdown
          as="li"
          renderMenuOnMount
          className="dropdown-user hidden-xs cursor-pointer"
          id="profile-dropdown"
          align="end"
          title={
            <>
              <Avatar user={user} link={false} size={24} />
              <span className="visible-xs-inline" aria-hidden="true">
                <Icon icon="user" fixedWidth size="lg" />
                {user.displayName}
              </span>
            </>
          }
        >
          <div className="dropdown-header" aria-hidden="true">
            {user.displayName}
          </div>
          <Dropdown.Divider />
          <Dropdown.Item href={`/profile/${user.username}`}>
            {t('My profile')}
          </Dropdown.Item>
          <Dropdown.Item href="/profile/edit">
            {t('Edit profile')}
          </Dropdown.Item>
          <Dropdown.Item href={`/profile/${user.username}/contacts`}>
            {t('Contacts')}
          </Dropdown.Item>
          <Dropdown.Item href="/search/members">
            {t('Find people')}
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item href="/profile/edit/account">
            {t('Account')}
          </Dropdown.Item>
          <Dropdown.Item
            onClick={event => onSignout(event)}
            href="/api/auth/signout"
            target="_top"
          >
            {t('Sign out')}
          </Dropdown.Item>
          <Dropdown.Divider />
          <SubMenuList
            list={[
              {
                href: '/',
                label: t('About'),
              },
              {
                href: '/foundation',
                label: t('Foundation'),
              },
              {
                href: '/media',
                label: t('Media'),
              },
              {
                href: '/privacy',
                label: t('Privacy'),
              },
              {
                href: '/rules',
                label: t('Rules'),
              },
              {
                href: '/safety',
                label: t('Safety'),
              },
              {
                href: '/statistics',
                label: t('Statistics'),
              },
              /* Disable shop and navigation links - issue #2672
              {
                href: 'https://trustroots.teemill.com',
                label: t('Shop'),
              },
              */
              {
                href: '/team',
                label: t('Team'),
              },
            ]}
          />
          <Dropdown.Divider />
          <SubMenuList
            list={[
              /*
              {
                href: 'https://www.facebook.com/trustroots.org',
                ariaLabel: t('Trustroots at Facebook'),
                label: 'Facebook',
              },
              {
                href: 'https://twitter.com/trustroots',
                ariaLabel: t('Trustroots at Twitter'),
                label: 'Twitter',
              },
              {
                href: 'https://www.instagram.com/trustroots/',
                ariaLabel: t('Trustroots at Instagram'),
                label: 'Instagram',
              },
              */
              {
                href: 'https://ideas.trustroots.org/',
                label: t('Blog'),
              },
              {
                href: 'https://wiki.trustroots.org/',
                label: t('Wiki'),
                target: '_blank',
                rel: 'noopener noreferrer',
              },
              {
                href: 'https://team.trustroots.org/',
                label: t('Volunteering'),
                target: '_blank',
                rel: 'noopener noreferrer',
              },
            ]}
          />
        </NavDropdown>
        <MenuItem
          aria-label={t('My profile, info and support')}
          className="visible-xs-block"
          currentPath={currentPath}
          path="/navigation"
        >
          <Icon icon="menu" fixedWidth size="lg" />
        </MenuItem>
      </Nav>
    </div>
  );
}

NavigationLoggedIn.propTypes = {
  currentPath: PropTypes.string.isRequired,
  onSignout: PropTypes.func.isRequired,
  user: userType,
};
