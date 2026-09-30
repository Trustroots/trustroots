import PropTypes from 'prop-types';
import React, { type ReactNode } from 'react';
import styled from 'styled-components';

const Dot = styled.div`
  background: #d9534f;
  border-radius: 50%;
  height: 7px;
  position: absolute;
  right: 9px;
  top: 6px;
  width: 7px;
`;

type BadgeProps = {
  children: ReactNode;
  withNotification?: boolean;
};

export default function Badge({ children, withNotification }: BadgeProps) {
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
