// import React from 'react';
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { $on } from '@/modules/core/client/services/angular-compat';

/**
 * Board Credits component Print out credits for photos used at the page.
 * Usage: `<BoardsCredits {...props}><WrappedComponent /></Tooltip>`
 *
 * @param {object} photos - object containing photo objects accessible by their keys
 */

/**
 * @TODO think about transforming photoCredits object structure to JSON
 */

export default function BoardCredits({ photoCredits: initialPhotoCredits }) {
  const { t } = useTranslation('messages');

  const [photoCredits, setPhotoCredits] = useState(initialPhotoCredits); // TODO: get initial value from app.photoCredits

  useEffect(() => {
    return () => {
      $on('photoCreditsUpdated', (scope, photo) => {
        setPhotoCredits({ ...photoCredits, ...photo });
      });
      // TODO implement removing credit
      $on('photoCreditsRemoved', (scope, photo) => {
        setPhotoCredits({ ...photoCredits, ...photo });
      });
    };
  }, []);

  const credits = Object.keys(photoCredits).map(key => {
    return { key, ...photoCredits[key] };
  });

  if (credits.length === 0) return null;

  return (
    <small className="font-brand-light">
      <span className="boards-credits">
        {credits.length === 1 && <span>Photo by </span>}
        {credits.length > 1 && <span>Photos by </span>}
        {credits.map((credit, index) => (
          <span key={credit.key}>
            <a href={credit.url} rel="noopener">
              {credit.name}
            </a>
            {credit.license && (
              <span>
                {' '}
                (
                <a
                  href={credit.license_url}
                  title={t('License')}
                  rel="license noopener"
                  aria-label={t('License')}
                >
                  {credit.license}
                </a>
                )
              </span>
            )}
            {index < credits.length - 1 && <span>, </span>}
          </span>
        ))}
      </span>
    </small>
  );
}

BoardCredits.propTypes = {
  photoCredits: PropTypes.object,
};
