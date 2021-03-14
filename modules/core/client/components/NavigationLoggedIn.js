// External dependencies
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import { userType } from '@/modules/users/client/users.prop-types';
import Avatar from '@/modules/users/client/components/Avatar.component.js';
import Icon from './Icon';
import SubMenuItem from './NavigationSubMenuItem';
import SubMenuList from './NavigationSubMenuList';

const SubMenuDivider = () => <li className="divider" role="presentation"></li>;

export default function NavigationLoggedIn({
  user,
  onSignout,
  path: currentPath,
}) {
  const { t } = useTranslation('core');

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
        <li className="hidden-xs dropdown" uib-dropdown>
          <a
            className="dropdown-toggle cursor-pointer"
            uib-dropdown-toggle
            tabIndex="0"
            role="button"
            aria-haspopup="true"
            aria-expanded="false"
          >
            {t('Support')}
          </a>
          <ul className="dropdown-menu" aria-label="submenu">
            <SubMenuItem
              path="/faq"
              label={t('FAQ')}
              currentPath={currentPath}
            />
            <SubMenuItem
              path="/support"
              label={t('Contact us')}
              currentPath={currentPath}
            />
          </ul>
        </li>
      </ul>

      <ul className="nav navbar-nav nav-header-primary">
        <li className={classnames({ active: currentPath === '/circles' })}>
          <a href="/circles" aria-label={t('Circles')}>
            <Icon
              className="visible-xs-block"
              fixedWidth
              icon="tribes"
              size="lg"
            />
            <span className="hidden-xs">{t('Circles')}</span>
          </a>
        </li>
        <li className={classnames({ active: currentPath === '/search' })}>
          <a href="/search" aria-label={t('Search hosts')}>
            <Icon
              className="visible-xs-block"
              fixedWidth
              icon="search"
              size="lg"
            />
            <span className="hidden-xs">{t('Search')}</span>
          </a>
        </li>
        <li className={classnames({ active: currentPath === '/messages' })}>
          <a href="/messages" aria-label={t('Messages')}>
            <Icon
              className="visible-xs-block"
              fixedWidth
              icon="messages"
              size="lg"
            />
            <span className="hidden-xs">{t('Messages')}</span>
            <unread-count></unread-count>
          </a>
        </li>
        <li
          className={classnames('hidden-xs', {
            active: currentPath === '/offer/host',
          })}
        >
          <a href="/offer/host">{t('Host')}</a>
        </li>
        <li
          className={classnames('hidden-xs', {
            active: currentPath === '/offer/meet',
          })}
        >
          <a href="/offer/meet">{t('Meet')}</a>
        </li>
        <li className="dropdown dropdown-user hidden-xs" uib-dropdown>
          <a
            className="dropdown-toggle cursor-pointer"
            role="button"
            uib-dropdown-toggle
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
            <SubMenuItem
              path={`/profile/${user.username}`}
              label={t('My profile')}
              currentPath={currentPath}
            />
            <SubMenuItem path="/profile/edit" label={t('Edit profile')} />
            <SubMenuItem
              path={`/profile/${user.username}/contacts`}
              label={t('Contacts')}
              currentPath={currentPath}
            />
            <SubMenuItem path="/search/members" label={t('Find people')} />
            <SubMenuDivider />
            <SubMenuItem
              path="/profile/edit/account"
              label={t('Account')}
              currentPath={currentPath}
            />
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
        <li ui-sref-active="active" className="visible-xs-block">
          <a href="/navigation" aria-label={t('My profile, info and support')}>
            <Icon icon="menu" fixedWidth size="lg" />
          </a>
        </li>
      </ul>
    </div>
  );
}

NavigationLoggedIn.propTypes = {
  onSignout: PropTypes.func.isRequired,
  user: userType,
  path: PropTypes.string.isRequired,
};
