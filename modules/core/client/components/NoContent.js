import PropTypes from 'prop-types';
import React from 'react';

export default function NoContent({ icon, message }) {
  return (
    <div className="row content-empty">
      {icon && <i className={ `icon-3x icon-${icon}`}></i>}
      <h4>{message}</h4>
    </div>
  );
}

NoContent.propTypes = {
  icon: PropTypes.string,
  message: PropTypes.string.isRequired,
};
