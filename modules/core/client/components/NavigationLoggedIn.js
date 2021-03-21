// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import { userType } from '@/modules/users/client/users.prop-types';
import Avatar from '@/modules/users/client/components/Avatar.component.js';
import Icon from './Icon';
import MenuItem from './NavigationMenuItem';
import SubMenuList from './NavigationSubMenuList';

const SubMenuDivider = () => <li className="divider" role="presentation"></li>;

export default function NavigationLoggedIn({ currentPath, onSignout, user }) {
  const { t } = useTranslation('core');

  console.log('currentPath:', currentPath); //eslint-disable-line

  return (
    <div className="container" role="navigation">
      <div className="navbar-header">
        <a href="/" className="navbar-brand hidden-xs" aria-hidden="true">
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

      <ul className="nav navbar-nav hidden-xs">
        <li className="hidden-xs dropdown">
          <a
            className="dropdown-toggle cursor-pointer"
            tabIndex="0"
            role="button"
            aria-haspopup="true"
            aria-expanded="false"
          >
            {t('Support')}
          </a>
          <ul className="dropdown-menu" aria-label="submenu">
            <MenuItem currentPath={currentPath} path="/faq">
              {t('FAQ')}
            </MenuItem>
            <MenuItem currentPath={currentPath} path="/support">
              {t('Contact us')}
            </MenuItem>
          </ul>
        </li>
      </ul>

      <ul className="nav navbar-nav nav-header-primary">
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
        <li className="dropdown dropdown-user hidden-xs">
          <a
            className="dropdown-toggle cursor-pointer"
            role="button"
            aria-label={t('My profile')}
            tabIndex="0"
            aria-haspopup="true"
          >
            <Avatar user={user} link={false} size={24} />
            <span className="visible-xs-inline" aria-hidden="true">
              <Icon icon="user" fixedWidth size="lg" />
              {user.displayName}
            </span>
            <b className="caret" role="presentation"></b>
          </a>
          <ul
            className="dropdown-menu dropdown-menu-right"
            aria-label="submenu"
          >
            <li
              role="presentation"
              className="dropdown-header"
              aria-hidden="true"
            >
              {user.displayName}
            </li>
            <SubMenuDivider />
            <MenuItem
              currentPath={currentPath}
              path={`/profile/${user.username}`}
            >
              {t('My profile')}
            </MenuItem>
            <MenuItem currentPath={currentPath} path="/profile/edit">
              {t('Edit profile')}
            </MenuItem>
            <MenuItem
              currentPath={currentPath}
              path={`/profile/${user.username}/contacts`}
            >
              {t('Contacts')}
            </MenuItem>
            <MenuItem currentPath={currentPath} path="/search/members">
              {t('Find people')}
            </MenuItem>
            <SubMenuDivider />
            <MenuItem currentPath={currentPath} path="/profile/edit/account">
              {t('Account')}
            </MenuItem>
            <li>
              <a
                onClick={event => onSignout(event)}
                href="/api/auth/signout"
                target="_top"
              >
                {t('Sign out')}
              </a>
            </li>
            <SubMenuDivider />
            <SubMenuList
              list={[
                {
                  href: '/',
                  label: t('About'),
                },
                {
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
                },
              ]}
            />
            <SubMenuDivider />
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
            />
          </ul>
        </li>
        <MenuItem
          aria-label={t('My profile, info and support')}
          className="visible-xs-block"
          currentPath={currentPath}
          path="/navigation"
        >
          <Icon icon="menu" fixedWidth size="lg" />
        </MenuItem>
      </ul>
    </div>
  );
}

NavigationLoggedIn.propTypes = {
  currentPath: PropTypes.string.isRequired,
  onSignout: PropTypes.func.isRequired,
  user: userType,
};
