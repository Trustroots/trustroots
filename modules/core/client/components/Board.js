import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import isArray from 'lodash/isArray';

import { selectPhoto } from '../services/photos.service';
import { $broadcast } from '@/modules/core/client/services/angular-compat';

/**
 * @param {string[]|string} names - array of names or a single name
 *
 * @returns {string} the provided name or randomly picked name from array
 */
function selectName(names) {
  return Array.isArray(names)
    ? names[Math.floor(Math.random() * names.length)]
    : names;
}

/**
 * Partially migrated tr-boards directive
 * modules/core/client/directives/tr-boards.client.directive.js
 *
 * @TODO implement primary, inset, error and maybe other attributes, which are currently board classes
 *  and which could become attributes <Board primary inset error names="bokeh" />
 */
export default function Board({
  names = 'bokeh',
  ignoreBackgroundOnSmallScreen = false,
  style = null,
  children,
  className,
  ...rest
}) {
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    // pick a name from provided names
    const selectedName = selectName(names);
    // select an appropriate photo by name
    const photo = selectPhoto(selectedName);
    const photoObject = { [selectedName]: photo };

    // update the state with the selected photo
    setPhoto(photo);

    // inform the parent that the photo is displayed
    // ...useful e.g. for displaying photo credits elsewere
    $broadcast('photoCreditsUpdated', photoObject);

    // inform the parent that the photo is not displayed anymore
    return () => {
      $broadcast('photoCreditsRemoved', photoObject);
    };
  }, [isArray(names) ? names.join(' ') : names]);

  if (photo) {
    style
      ? (style.backgroundImage = `url("${photo.imageUrl}")`)
      : (style = { backgroundImage: `url("${photo.imageUrl}")` });
  }
  const addedClasses = ['board'];
  if (ignoreBackgroundOnSmallScreen) {
    addedClasses.push('small-screen-bad-background');
  }
  return (
    <section
      style={{ ...style }}
      className={classNames(addedClasses, className)}
      {...rest}
    >
      {children}
    </section>
  );
}

Board.propTypes = {
  names: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]).isRequired,
  ignoreBackgroundOnSmallScreen: PropTypes.bool,
  style: PropTypes.object,
  className: PropTypes.string,
  children: PropTypes.node,
};
