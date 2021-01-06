import PropTypes from 'prop-types';
import React from 'react';

export default function NoContent({ children = null, icon, message }) {
  return (
    <div className="row content-empty">
      {icon && <i className={`icon-3x icon-${icon}`}></i>}
      <h4>{message}</h4>
      {children}
    </div>
  );
}

NoContent.propTypes = {
  children: PropTypes.node,
  icon: PropTypes.string,
  message: PropTypes.string.isRequired,
};
