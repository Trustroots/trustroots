import PropTypes from 'prop-types';
import React, { type ReactElement } from 'react';
import { Tooltip as BootstrapTooltip, OverlayTrigger } from 'react-bootstrap';

type HoverTooltipProps = Omit<
  React.ComponentProps<typeof BootstrapTooltip>,
  'children'
> & {
  children: ReactElement;
  tooltip: string;
  placement?: 'left' | 'top' | 'right' | 'bottom';
  hidden?: boolean;
};

export default function HoverTooltip({
  children,
  tooltip,
  placement = 'top',
  hidden = false,
  ...props
}: HoverTooltipProps) {
  if (hidden) return children;
  const tooltipComponent = (
    <BootstrapTooltip {...props}>{tooltip}</BootstrapTooltip>
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
