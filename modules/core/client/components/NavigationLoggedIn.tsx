// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React, { type MouseEvent } from 'react';
import {
  Navbar,
  NavDropdown,
  Nav,
  MenuItem as DropMenuItem,
} from 'react-bootstrap';

// Internal dependencies
import { userType } from '@/modules/users/client/users.prop-types';
import type { AuthUser } from '@/modules/core/client/react-app/auth';
import Avatar from '@/modules/users/client/components/Avatar.component.js';
import UnreadCount from '@/modules/messages/client/components/UnreadCount.component';
import Icon from './Icon';
import MenuItem from './NavigationMenuItem';
import SubMenuList from './NavigationSubMenuList';

type Props = {
  currentPath: string;
  onSignout: (event?: MouseEvent<HTMLElement>) => void;
  user: AuthUser;
};
export default function NavigationLoggedIn({
  currentPath,
  onSignout,
  user,
}: Props) {
  const { t } = useTranslation('core');

  return (
    <div className="container">
      <Navbar.Header>
        <Navbar.Brand>
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
      </Navbar.Header>

      <Nav className="hidden-xs">
        <NavDropdown
          className="hidden-xs cursor-pointer"
          id="support-dropdown"
          title={t<string>('Support')}
        >
          <DropMenuItem href="/faq">
            {t<string>('Frequently Asked Questions')}
          </DropMenuItem>
          <DropMenuItem href="/safety">{t<string>('Safety')}</DropMenuItem>
          <DropMenuItem href="/faq/bugs-and-features">
            {t<string>('Report a bug')}
          </DropMenuItem>
          <DropMenuItem href="/support">{t<string>('Contact us')}</DropMenuItem>
        </NavDropdown>
      </Nav>

      <Nav className="nav-header-primary">
        <MenuItem
          currentPath={currentPath}
          path="/circles"
          aria-label={t<string>('Circles')}
        >
          <Icon
            className="visible-xs-block"
            fixedWidth
            icon="tribes"
            size="lg"
          />
          <span className="hidden-xs">{t<string>('Circles')}</span>
        </MenuItem>
        <MenuItem
          currentPath={currentPath}
          path="/search"
          aria-label={t<string>('Search hosts')}
        >
          <Icon
            className="visible-xs-block"
            fixedWidth
            icon="search"
            size="lg"
          />
          <span className="hidden-xs">{t<string>('Search')}</span>
        </MenuItem>
        <MenuItem
          currentPath={currentPath}
          path="/messages"
          aria-label={t<string>('Messages')}
        >
          <Icon
            className="visible-xs-block"
            fixedWidth
            icon="messages"
            size="lg"
          />
          <span className="hidden-xs">{t<string>('Messages')}</span>
          <UnreadCount />
        </MenuItem>
        <MenuItem
          currentPath={currentPath}
          path="/offer/host"
          className="hidden-xs"
        >
          {t<string>('Host')}
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
          className="dropdown-user hidden-xs cursor-pointer"
          id="profile-dropdown"
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
            {t<string>('My profile')}
          </DropMenuItem>
          <DropMenuItem href="/profile/edit">
            {t<string>('Edit profile')}
          </DropMenuItem>
          <DropMenuItem href={`/profile/${user.username}/contacts`}>
            {t<string>('Contacts')}
          </DropMenuItem>
          <DropMenuItem href="/search/members">
            {t<string>('Find people')}
          </DropMenuItem>
          <DropMenuItem divider />
          <DropMenuItem href="/profile/edit/account">
            {t<string>('Account')}
          </DropMenuItem>
          <DropMenuItem
            onClick={(event: MouseEvent<HTMLElement>) => onSignout(event)}
            href="/api/auth/signout"
            target="_top"
          >
            {t<string>('Sign out')}
          </DropMenuItem>
          <DropMenuItem divider />
          <SubMenuList
            list={[
              {
                href: '/',
                label: t<string>('About'),
              },
              {
                href: '/foundation',
                label: t<string>('Foundation'),
              },
              {
                href: '/media',
                label: t<string>('Media'),
              },
              {
                href: '/privacy',
                label: t<string>('Privacy'),
              },
              {
                href: '/rules',
                label: t<string>('Rules'),
              },
              {
                href: '/safety',
                label: t<string>('Safety'),
              },
              {
                href: '/statistics',
                label: t<string>('Statistics'),
              },
              /* Disable shop and navigation links - issue #2672
              {
                href: 'https://trustroots.teemill.com',
                label: t<string>('Shop'),
              },
              */
              {
                href: '/team',
                label: t<string>('Team'),
              },
            ]}
          />
          <DropMenuItem divider />
          <SubMenuList
            list={[
              /*
              {
                href: 'https://www.facebook.com/trustroots.org',
                ariaLabel: t<string>('Trustroots at Facebook'),
                label: 'Facebook',
              },
              {
                href: 'https://twitter.com/trustroots',
                ariaLabel: t<string>('Trustroots at Twitter'),
                label: 'Twitter',
              },
              {
                href: 'https://www.instagram.com/trustroots/',
                ariaLabel: t<string>('Trustroots at Instagram'),
                label: 'Instagram',
              },
              */
              {
                href: 'https://ideas.trustroots.org/',
                label: t<string>('Blog'),
              },
              {
                href: 'https://wiki.trustroots.org/',
                label: t<string>('Wiki'),
                target: '_blank',
                rel: 'noopener noreferrer',
              },
              {
                href: '/support?category=volunteering',
                label: t<string>('Volunteering'),
              },
            ]}
          />
        </NavDropdown>
        <MenuItem
          aria-label={t<string>('My profile, info and support')}
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
