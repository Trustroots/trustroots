/* eslint angular/json-functions: 0 */

import React from 'react';
import PropTypes from 'prop-types';

export default function Reference({ reference }) {
  return (
    <div>
      {JSON.stringify(reference)}
    </div>
  );
}

Reference.propTypes = {
  reference: PropTypes.object.isRequired
};
