import React from 'react';
import PropTypes from 'prop-types';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';

/**
 * Tooltip component adds a tooltip to its children. It appears on hover.
 * Usage: `<Tooltip {...props><WrappedComponent /></Tooltip>`
 *
 * @param {string} tooltip - the text to display as tooltip
 *                           ( in fact it could be any kind of React.node)
 * @param {left|top|right|bottom} [placement=top] - placement of the tooltip
 * @param {boolean} [hidden=false] - when set to true, the tooltip is not rendered
 * @param {string} [id=hover-tooltip] - id is required for accessibility
 *                                      setting your own will avoid id duplicates
 * @param {React.node} children - normally, pass this as Tooltip children, not in props
 */
export default function HoverTooltip({
  children,
  tooltip,
  placement = 'top',
  hidden = false,
  ...props
}) {
  if (hidden) return children;
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
  hidden: PropTypes.bool,
};
