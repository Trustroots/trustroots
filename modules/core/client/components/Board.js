import { Children, cloneElement, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { selectPhoto } from '../services/photos.service';

/**
 * @param {string[]|string} names - array of names or a single name
 *
 * @returns {string} the provided name or randomly picked name from array
 */
function selectName(names) {
  return Array.isArray(names) ? names[Math.floor(Math.random() * names.length)] : names;
}

/**
 * Partially migrated tr-boards directive
 * modules/core/client/directives/tr-boards.client.directive.js
 *
 * @TODO implement tr-boards-ignore-small directive
 */
export default function Board({ names='bokeh', children, onDisplayPhoto=() => {}, onHidePhoto=() => {} }) {

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
    onDisplayPhoto(photoObject);

    // inform the parent that the photo is not displayed anymore
    return () => onHidePhoto(photoObject);
  }, []);

  const style = photo ? { backgroundImage: `url("${photo.imageUrl}")` } : null;
  return Children.map(children, child => cloneElement(child, { style }));
}

Board.propTypes = {
  names: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string)
  ]).isRequired,
  onDisplayPhoto: PropTypes.func,
  onHidePhoto: PropTypes.func
};
