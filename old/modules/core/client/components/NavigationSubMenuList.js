// External dependencies
import PropTypes from 'prop-types';
import React from 'react';

export default function NavigationSubMenuList({ list }) {
  return (
    <li className="small text-muted dropdown-meta text-center font-brand-regular">
      <ul className="list-inline">
        {list.map(({ href, label }) => (
          <li key={href}>
            <a className="text-muted" href={href}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </li>
  );
}

NavigationSubMenuList.propTypes = {
  list: PropTypes.array.isRequired,
};
