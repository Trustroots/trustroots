// External dependencies
import { useTranslation } from 'react-i18next';
import React, { useEffect, useState, type MouseEvent } from 'react';
import { Navbar, NavDropdown, Nav, Dropdown } from 'react-bootstrap';

// Internal dependencies
import type { AuthUser } from '@/modules/core/client/react-app/auth';
import Avatar from '@/modules/users/client/components/Avatar.component.js';
import UnreadCount from '@/modules/messages/client/components/UnreadCount.component';
import Icon from './Icon';
import MenuItem from './NavigationMenuItem';
import SubMenuList from './NavigationSubMenuList';
import {
  listMemberships,
  type TribeSummary,
} from '@/modules/tribes/client/api/tribes.api';

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
  const [memberships, setMemberships] = useState<TribeSummary[]>([]);
  useEffect(() => {
    let active = true;
    setMemberships([]);
    listMemberships().then(
      result => {
        if (active) {
          setMemberships(result.flatMap(({ tribe }) => (tribe ? [tribe] : [])));
        }
      },
      () => {
        // Keep the primary Circles link available if shortcuts cannot be loaded.
      },
    );
    return () => {
      active = false;
    };
  }, [user._id, user.member]);
  const circles = [...memberships]
    .sort(
      (left, right) =>
        Number(right.slug === 'hackers') - Number(left.slug === 'hackers') ||
        right.count - left.count,
    )
    .slice(0, 10);

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
          <Dropdown.Item href="/support?category=reportBug">
            {t('Report a bug')}
          </Dropdown.Item>
          <Dropdown.Item href="/support">{t('Contact us')}</Dropdown.Item>
        </NavDropdown>
      </Nav>

      <Nav as="ul" className="nav-header-primary">
        {(user.roles?.includes('admin') ||
          user.roles?.includes('support-team') ||
          user.roles?.includes('welcome-team')) && (
          <MenuItem
            currentPath={currentPath}
            path={
              user.roles?.includes('support-team') &&
              !user.roles?.includes('admin')
                ? '/admin/support'
                : user.roles?.includes('welcome-team')
                  ? '/admin/acquisition-stories'
                  : '/admin'
            }
            className="hidden-xs"
          >
            Admin
          </MenuItem>
        )}
        <MenuItem
          currentPath={currentPath}
          path="/circles"
          aria-label={t('Circles')}
          className={
            circles.length ? 'dropdown header-link-dropdown' : undefined
          }
          submenu={
            circles.length > 0 && (
              <ul className="dropdown-menu hidden-xs">
                {circles.map(tribe => (
                  <li key={tribe._id}>
                    <a
                      className="dropdown-item"
                      href={`/circles/${encodeURIComponent(tribe.slug)}`}
                    >
                      {tribe.label}
                    </a>
                  </li>
                ))}
              </ul>
            )
          }
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
          className="dropdown header-link-dropdown"
          submenu={
            <ul className="dropdown-menu hidden-xs">
              <li>
                <a className="dropdown-item" href="/search/members">
                  {t('Find member by name')}
                </a>
              </li>
            </ul>
          }
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
                href: '/support?category=volunteering',
                label: t('Volunteering'),
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
