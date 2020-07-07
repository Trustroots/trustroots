// External dependencies
import classnames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import zendeskInboxIcon from '../images/zendesk-inbox.svg';

export default function ZendeskInboxSearch({ className, q }) {
  return (
    <a
      aria-label={`Search from support with ${q}`}
      className={classnames('zendesk-inbox-search', className)}
      href={`https://trustroots.zendesk.com/inbox/search?q=${q}`}
      rel="noopener noreferrer"
      target="_blank"
      title="Search from support"
    >
      <img
        src={zendeskInboxIcon}
        width="16"
        height="16"
        alt=""
        aria-hidden="true"
        focusable="false"
      />
    </a>
  );
}

ZendeskInboxSearch.propTypes = {
  className: PropTypes.string,
  q: PropTypes.string.isRequired,
};
