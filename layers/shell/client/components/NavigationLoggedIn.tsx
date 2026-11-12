// External dependencies
import { useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';
import { NavigationDropdown } from '@trustroots/ui/NavigationDropdown';

// Internal dependencies
import {
  useAnalytics,
  type NavigationItem,
} from '@trustroots/analytics/client';
import { useAuth, type AuthUser } from '@/modules/core/client/react-app/auth';
import Avatar from '@/modules/users/client/components/Avatar.component.js';
import UnreadCount from '@/modules/messages/client/components/UnreadCount.component';
import Icon from '@/modules/core/client/components/Icon';
import MenuItem from './NavigationMenuItem';
import SubMenuList from './NavigationSubMenuList';
import {
  listMemberships,
  type TribeSummary,
} from '@/modules/tribes/client/api/tribes.api';

type Props = {
  currentPath: string;
  user: AuthUser;
};
export default function NavigationLoggedIn({ currentPath, user }: Props) {
  const { t } = useTranslation('core');
  const { signOut } = useAuth();
  const { track } = useAnalytics();
  const trackNav = (item: NavigationItem) => () =>
    track('navigation_clicked', { surface: 'top', item });
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
    <nav className="container" aria-label={t('Page navigation')}>
      <div className="navbar-header">
        <div className="navbar-brand">
          <a href="/" className="hidden-xs">
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
        </div>
      </div>

      <ul className="navbar-nav hidden-xs">
        <NavigationDropdown
          className="hidden-xs cursor-pointer"
          id="support-dropdown"
          label={t('Support')}
        >
          <a
            className="dropdown-item"
            href="/faq"
            onClick={trackNav('support_faq')}
          >
            {t('Frequently Asked Questions')}
          </a>
          <a
            className="dropdown-item"
            href="/safety"
            onClick={trackNav('support_safety')}
          >
            {t('Safety')}
          </a>
          <a
            className="dropdown-item"
            href="/support?category=reportBug"
            onClick={trackNav('support_report_bug')}
          >
            {t('Report a bug')}
          </a>
          <a
            className="dropdown-item"
            href="/support"
            onClick={trackNav('support_contact')}
          >
            {t('Contact us')}
          </a>
        </NavigationDropdown>
      </ul>

      <ul className="navbar-nav nav-header-primary">
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
            onLinkClick={trackNav('admin')}
            className={
              currentPath === '/admin' || currentPath.startsWith('/admin/')
                ? 'hidden-xs active'
                : 'hidden-xs'
            }
          >
            Admin
          </MenuItem>
        )}
        <MenuItem
          currentPath={currentPath}
          path="/circles"
          onLinkClick={trackNav('circles')}
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
          onLinkClick={trackNav('search')}
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
          onLinkClick={trackNav('messages')}
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
          onLinkClick={trackNav('host')}
          className="hidden-xs"
        >
          {t('Host')}
        </MenuItem>
        <MenuItem
          currentPath={currentPath}
          path="https://nos.trustroots.org/"
          onLinkClick={trackNav('nostroots')}
          target="_blank"
          className="hidden-xs"
        >
          Nostroots
        </MenuItem>
        <NavigationDropdown
          className="dropdown-user hidden-xs cursor-pointer"
          id="profile-dropdown"
          align="end"
          label={
            <>
              <span className="sr-only">{t('Profile menu')}</span>
              <span aria-hidden="true">
                <Avatar user={user} link={false} size={24} />
              </span>
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
          <hr className="dropdown-divider" />
          <a
            className="dropdown-item"
            href={`/profile/${user.username}`}
            onClick={trackNav('profile')}
          >
            {t('My profile')}
          </a>
          <a
            className="dropdown-item"
            href="/profile/edit"
            onClick={trackNav('profile_edit')}
          >
            {t('Edit profile')}
          </a>
          <a
            className="dropdown-item"
            href={`/profile/${user.username}/contacts`}
            onClick={trackNav('contacts')}
          >
            {t('Contacts')}
          </a>
          <a
            className="dropdown-item"
            href="/search/members"
            onClick={trackNav('find_people')}
          >
            {t('Find people')}
          </a>
          <hr className="dropdown-divider" />
          <a
            className="dropdown-item"
            href="/profile/edit/account"
            onClick={trackNav('account')}
          >
            {t('Account')}
          </a>
          <button
            type="button"
            onClick={() => void signOut()}
            className="dropdown-item tw:hover:underline! tw:focus:bg-brand-primary! tw:focus:text-white! tw:focus:underline! tw:focus:outline-none! tw:active:bg-brand-primary! tw:active:text-white! tw:active:no-underline!"
          >
            {t('Sign out')}
          </button>
          <hr className="dropdown-divider" />
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
          <hr className="dropdown-divider" />
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
        </NavigationDropdown>
        <MenuItem
          aria-label={t('My profile, info and support')}
          className="visible-xs-block"
          currentPath={currentPath}
          path="/navigation"
          onLinkClick={trackNav('menu')}
        >
          <Icon icon="menu" fixedWidth size="lg" />
        </MenuItem>
      </ul>
    </nav>
  );
}
