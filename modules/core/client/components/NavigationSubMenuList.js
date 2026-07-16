// External dependencies
import PropTypes from 'prop-types';
import React from 'react';

export default function NavigationSubMenuList({ list }) {
  return (
    <li className="small text-muted dropdown-meta text-center font-brand-regular">
      <ul className="list-inline">
        {list.map(({ href, label, rel, target }) => (
          <li key={href}>
            <a className="text-muted" href={href} rel={rel} target={target}>
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
