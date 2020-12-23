// External dependencies
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';
import classnames from 'classnames';

const Container = styled.div`
  display: flex;
  flex-direction: column;

  .panel-body {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
`;

export default function Stat({ children, title, className }) {
  return (
    <Container className={classnames('panel', 'panel-default', className)}>
      <div className="panel-heading">
        <h3 className="panel-title">{title}</h3>
      </div>
      <div className="panel-body">{children}</div>
    </Container>
  );
}

Stat.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  title: PropTypes.string.isRequired,
};
