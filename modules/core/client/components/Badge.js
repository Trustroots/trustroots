// External dependencies
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

const Dot = styled.div`
  background: #d9534f;
  border-radius: 50%;
  height: 5px;
  position: absolute;
  right: 10px;
  top: 6px;
  width: 5px;
`;

export default function Badge({ children, withNotification }) {
  return (
    <span className="badge">
      {children}
      {withNotification && <Dot />}
    </span>
  );
}

Badge.propTypes = {
  children: PropTypes.node.isRequired,
  withNotification: PropTypes.bool,
};
