// External dependencies
import classnames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

const Menu = styled.ul`
  margin-bottom: 20px;
`;

export default function AdminAcquisitionStoriesMenu({ active }) {
  return (
    <Menu className="nav nav-tabs">
      <li
        role="presentation"
        className={classnames({
          active: active === 'stories',
        })}
      >
        <a href="/admin/acquisition-stories">Stories</a>
      </li>
      <li
        role="presentation"
        className={classnames({
          active: active === 'analysis',
        })}
      >
        <a href="/admin/acquisition-stories/analysis">Analysis</a>
      </li>
    </Menu>
  );
}

AdminAcquisitionStoriesMenu.propTypes = {
  active: PropTypes.string.isRequired,
};
