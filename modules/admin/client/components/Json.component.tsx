// External dependencies
import React from 'react';
import PropTypes from 'prop-types';

export default function Json({ content }: { content: object }) {
  return <pre>{JSON.stringify(content, null, 2)}</pre>;
}

Json.propTypes = {
  content: PropTypes.object.isRequired,
};
