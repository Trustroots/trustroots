import React from 'react';
import PropTypes from 'prop-types';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';

/**
 * A higher order component that adds tooltip to the wrapped component
 */
export default function withTooltip(WrappedComponent) {
  function HOComponent({ tooltip, placement = 'top', tooltipProps, ...props }) {
    const _tooltip = (
      <Tooltip id="tooltip" {...tooltipProps}>
        {tooltip}
      </Tooltip>
    );
    return (
      <OverlayTrigger placement={placement} overlay={_tooltip}>
        <WrappedComponent {...props} />
      </OverlayTrigger>
    );
  }

  HOComponent.propTypes = {
    tooltip: PropTypes.string.isRequired,
    tooltipProps: PropTypes.object,
    placement: PropTypes.string,
  };

  HOComponent.displayName = `WithTooltip(${getDisplayName(WrappedComponent)})`;
  return HOComponent;
}

function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}
