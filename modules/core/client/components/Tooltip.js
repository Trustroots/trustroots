import React from 'react';
import PropTypes from 'prop-types';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';

/**
 * A component that adds tooltip to its children
 */
export default function HoverTooltip({
  children,
  tooltip,
  placement = 'top',
  ...props
}) {
  const tooltipComponent = (
    <Tooltip id="hover-tooltip" {...props}>
      {tooltip}
    </Tooltip>
  );
  return (
    <OverlayTrigger placement={placement} overlay={tooltipComponent}>
      {children}
    </OverlayTrigger>
  );
}

HoverTooltip.propTypes = {
  children: PropTypes.node.isRequired,
  tooltip: PropTypes.string.isRequired,
  placement: PropTypes.string,
};
