// External dependencies
import React from 'react';
import PropTypes from 'prop-types';

export default function Json({ content }) {
  return (
    <pre>{ JSON.stringify(content, null, 2) }</pre>
  );
}

Json.propTypes = {
  content: PropTypes.object.isRequired
};
