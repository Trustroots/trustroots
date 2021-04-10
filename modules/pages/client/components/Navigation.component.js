import React from 'react';
import Avatar from '@/modules/users/client/components/Avatar.component.js';
import PropTypes from 'prop-types';
import { userType } from '@/modules/users/client/users.prop-types';
import { useTranslation } from 'react-i18next';

export default function Navigation({ user, onSignout, isNativeMobileApp }) {
  const { t } = useTranslation('pages');

  return (
    <>
      <div className="list-group container-spacer font-brand-regular">
        <a
          className="list-group-item page-navigation-profile"
          href={`/profile/${user.username}`}
        >
          <Avatar user={user} link={false} size={64} />
          <h4 className="list-group-item-heading">{user.displayName}</h4>
          <p className="list-group-item-text text-muted">
            {t('View your profile')}
          </p>
        </a>

        <a href="/profile/edit" className="list-group-item">
          {t('Edit profile')}
        </a>

        <a href="/offer/host" className="list-group-item">
          {t('Host')}
        </a>

        <a href="/offer/meet" className="list-group-item">
          {t('Meet')}
        </a>

        <a
          href={`/profile/${user.username}/contacts`}
          className="list-group-item"
        >
          {t('Contacts')}
        </a>

        <a href="/search/members" className="list-group-item">
          {t('Find people')}
        </a>

        <a href="/circles" className="list-group-item">
          {t('Circles')}
        </a>

        <a href="/profile/edit/account" className="list-group-item">
          {t('Account')}
        </a>

        <a
          onClick={event => onSignout(event)}
          href="/api/auth/signout"
          target="_top"
          className="list-group-item"
        >
          <i className="icon-sign-out icon-fw icon-lg"></i> {t('Sign out')}
        </a>
      </div>

      <div className="container">
        <h5 className="text-uppercase text-muted">{t('Info & support')}</h5>
      </div>

      <div className="list-group font-brand-regular">
        <a className="list-group-item" href="/support">
          {t('Contact & Support')}
        </a>
        <a className="list-group-item" href="/faq">
          {t('FAQ')}
        </a>
        <a className="list-group-item" href="/about">
          {t('About')}
        </a>
        <a className="list-group-item" href="https://ideas.trustroots.org/">
          {t('Blog')}
        </a>
        <a className="list-group-item" href="/media">
          {t('Media')}
        </a>
        <a className="list-group-item" href="/foundation">
          {t('Foundation')}
        </a>
        <a className="list-group-item" href="/privacy">
          {t('Privacy')}
        </a>
        <a className="list-group-item" href="/rules">
          {t('Rules')}
        </a>
      </div>

      <div className="container font-brand-regular">
        {!isNativeMobileApp && (
          <p className="home-apps">
            <a
              href="https://play.google.com/store/apps/details?id=org.trustroots.trustrootsApp"
              className="btn btn-default btn-app center-block"
            >
              <svg viewBox="0 0 2700 800" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M499 464L235 664c-8-3-14-12-14-25V290c0-14 6-23 15-26l263 200z"
                  fill="url(#goo1)"
                />
                <path
                  d="M499 530L258 661c-9 5-17 5-23 3l211-213 53 79z"
                  fill="url(#goo2)"
                />
                <path
                  d="M236 264c6-2 14-1 22 4l240 131-53 77-209-212z"
                  fill="url(#goo3)"
                />
                <path
                  d="M498 399l85 46c20 11 20 28 0 39l-84 46-66-66 65-65z"
                  fill="url(#goo4)"
                />
                <path d="M1292 230c35 0 61-27 61-61 0-35-27-62-61-62s-61 28-61 62 27 61 61 61zm0-14c-26 0-45-21-45-47s19-48 45-48 46 22 46 48-20 47-46 47zm-14 373c50 0 89-38 89-88s-39-89-89-89-89 39-89 89 39 88 89 88zm0-35c-28 0-50-24-50-53 0-30 21-54 50-54 30 0 50 23 50 54 0 29-22 53-50 53zm240 13v15c0 32-16 51-47 51-34 0-44-31-44-31l-34 14s19 52 78 52c54 0 84-35 84-92V418h-37v15c-7-10-26-21-47-21-47 0-85 41-85 89 0 47 38 88 85 88 21 0 39-9 47-22zm1030-156c0-1-46-1-46-1l-47 118-51-118-44 1 74 167-41 87h44zm-244 150h2v24h39V480c0-54-38-80-84-80-56 0-73 41-73 41l34 16s10-21 39-21c21 0 44 13 44 39-32-18-123-13-123 53 0 49 49 63 68 63 25 0 41-10 54-30zm-570 28c35 0 60-19 74-39l-31-20s-12 24-43 24c-19 0-34-9-43-27l118-49c-11-33-36-66-79-66-49 0-84 39-84 89s38 88 88 88zm-650 0c50 0 89-38 89-88s-39-89-89-89-89 39-89 89 39 88 89 88zm-233 0c80 0 140-60 126-150H851v38h89c-5 47-40 74-89 74-56 0-99-44-99-99 0-57 44-100 99-100 26 0 48 9 67 27l27-27c-27-24-58-38-94-38-75 0-140 62-140 138s64 137 140 137zm1299-4V327h-39v258h39zm-156-258h-90v258h39V485h51c48 0 83-32 83-79s-35-79-83-79zm-370 257V324h-39v260h39zm-150-30c-29 0-49-24-49-53 0-30 20-54 49-54s47 24 47 54c0 29-19 53-47 53zm-390 0c-28 0-50-24-50-53 0-30 21-54 50-54 30 0 50 23 50 54 0 29-22 53-50 53zm1171-2c-14 0-32-6-32-23 0-36 65-36 83-19 0 10-19 42-51 42zm-571-54c0-35 28-52 47-52 12 0 27 6 33 19zm311-133c27 0 42 23 42 41s-13 41-42 41h-52v-82h52zM842 165h-58v14h43c-1 23-20 37-43 37-25 0-46-20-46-47 0-30 23-48 46-48s33 14 33 14l10-10s-13-18-43-18c-34 0-61 27-61 62 0 33 26 61 61 61 34 0 63-25 58-65zm544 63v-97l60 97h16V110h-15v69l1 23h-1l-57-92h-19v118h15zm-198-104v-14h-81v14h33v104h15V124h33zm-97 104V110h-15v118h15zm-67-104v-14h-81v14h33v104h15V124h33zm-94 0v-14h-69v118h69v-15h-54v-37h49v-14h-49v-38h54z" />
                <defs>
                  <linearGradient id="goo1" gradientTransform="rotate(90)">
                    <stop offset="0%" stopColor="#3588b7" />
                    <stop offset="100%" stopColor="#66ffd4" />
                  </linearGradient>
                  <linearGradient id="goo2">
                    <stop offset="0%" stopColor="#9635c2" />
                    <stop offset="100%" stopColor="#e3424f" />
                  </linearGradient>
                  <linearGradient id="goo3">
                    <stop offset="0%" stopColor="#60cab6" />
                    <stop offset="100%" stopColor="#d6ffa2" />
                  </linearGradient>
                  <linearGradient id="goo4" gradientTransform="rotate(45)">
                    <stop offset="0%" stopColor="#ff9877" />
                    <stop offset="100%" stopColor="#ffc466" />
                  </linearGradient>
                </defs>
              </svg>
            </a>
            <br />
          </p>
        )}
        <ul className="list-inline text-center">
          <li>
            <p>
              <a
                href="https://www.facebook.com/trustroots.org"
                className="btn btn-default center-block"
                aria-label={t('Trustroots page at Facebook')}
              >
                {t('Facebook page')}
              </a>
            </p>
          </li>
          <li>
            <p>
              <a
                href="https://www.facebook.com/trustroots.org"
                className="btn btn-default center-block"
                aria-label={t('Trustroots group at Facebook')}
              >
                {t('Facebook group')}
              </a>
            </p>
          </li>
          <li>
            <p>
              <a
                href="https://twitter.com/trustroots"
                className="btn btn-default center-block"
                aria-label={t('Trustroots at Twitter')}
              >
                Twitter
              </a>
            </p>
          </li>
          <li>
            <p>
              <a
                href="https://www.instagram.com/trustroots/"
                className="btn btn-default center-block"
                aria-label={t('Trustroots at Instagram')}
              >
                Instagram
              </a>
            </p>
          </li>
          <li>
            <p>
              <a
                href="https://github.com/Trustroots/trustroots"
                className="btn btn-default center-block"
                aria-label={t('Trustroots at GitHub')}
              >
                GitHub
              </a>
            </p>
          </li>
        </ul>
      </div>
    </>
  );
}

Navigation.propTypes = {
  user: userType,
  isNativeMobileApp: PropTypes.bool,
  onSignout: PropTypes.func,
};
