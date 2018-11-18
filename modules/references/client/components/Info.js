import React from 'react';
import PropTypes from 'prop-types';

/**
 * @TODO make these elements nicer
 */

export function Self() {
  return (<div>Self</div>);
}

export function Loading() {
  return (<div>Loading</div>);
}

export function Duplicate() {
  return (<div>Duplicate</div>);
}

export function Submitted({ isReported, isPublic }) {
  return (
    <div>
      <div>Submitted</div>
      {(isReported) ? <div>Reported</div> : null}
      <div>{(isPublic) ? '' : 'not '}public</div>
    </div>
  );
}

Submitted.propTypes = {
  isReported: PropTypes.boolean,
  isPublic: PropTypes.boolean
};
