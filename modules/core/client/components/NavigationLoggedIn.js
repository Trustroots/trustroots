// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import {
  Navbar,
  NavDropdown,
  Nav,
  MenuItem as DropMenuItem,
} from 'react-bootstrap';

// Internal dependencies
import { userType } from '@/modules/users/client/users.prop-types';
import Avatar from '@/modules/users/client/components/Avatar.component.js';
import Icon from './Icon';
import MenuItem from './NavigationMenuItem';
import SubMenuList from './NavigationSubMenuList';

export default function NavigationLoggedIn({ currentPath, onSignout, user }) {
  const { t } = useTranslation('core');

  return (
    <div className="container">
      <Navbar.Header>
        <Navbar.Brand>
          <a href="/" className="hidden-xs" aria-hidden="true">
            <img
              className="hidden-xs hidden-sm"
              src="/placeholder.png"
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
      </Navbar.Header>

      <Nav className="hidden-xs">
        <NavDropdown
          className="hidden-xs cursor-pointer"
          id="support-dropdown"
          title={t('Support')}
        >
          {/*           <DropMenuItem href="/faq">
            {t('Frequently Asked Questions')}
          </DropMenuItem> */}
          <DropMenuItem href="/support">{t('Contact us')}</DropMenuItem>
        </NavDropdown>
      </Nav>

      <Nav className="nav-header-primary">
        {/*         <MenuItem
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
        </MenuItem> */}
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
          <unread-count></unread-count>
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
          path="/offer/meet"
          className="hidden-xs"
        >
          {t('Meet')}
        </MenuItem>
        <NavDropdown
          className="dropdown-user hidden-xs cursor-pointer"
          id="support-dropdown"
          pullRight
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
          <li
            role="presentation"
            className="dropdown-header"
            aria-hidden="true"
          >
            {user.displayName}
          </li>
          <DropMenuItem divider />
          <DropMenuItem href={`/profile/${user.username}`}>
            {t('My profile')}
          </DropMenuItem>
          <DropMenuItem href="/profile/edit">{t('Edit profile')}</DropMenuItem>
          <DropMenuItem href={`/profile/${user.username}/contacts`}>
            {t('Contacts')}
          </DropMenuItem>
          <DropMenuItem href="/search/members">{t('Find people')}</DropMenuItem>
          <DropMenuItem divider />
          <DropMenuItem href="/profile/edit/account">
            {t('Account')}
          </DropMenuItem>
          <DropMenuItem
            onClick={event => onSignout(event)}
            href="/api/auth/signout"
            target="_top"
          >
            {t('Sign out')}
          </DropMenuItem>
          <DropMenuItem divider />
          <SubMenuList
            list={[
              {
                href: '/',
                label: t('About'),
              },
              /*               {
                href: '/volunteering',
                label: t('Volunteering'),
              },
              {
                href: '/contribute',
                label: t('Contribute'),
              },
              {
                href: '/media',
                label: t('Media'),
              },
              {
                href: '/foundation',
                label: t('Foundation'),
              },
              {
                href: '/team',
                label: t('Team'),
              },
              {
                href: '/privacy',
                label: t('Privacy'),
              },
              {
                href: '/rules',
                label: t('Rules'),
              }, */
            ]}
          />
          {/*           <DropMenuItem divider />
          <SubMenuList
            list={[
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
              {
                href: 'https://ideas.trustroots.org/',
                label: t('Blog'),
              },
            ]}
          /> */}
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
