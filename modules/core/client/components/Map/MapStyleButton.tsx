// External dependencies
import { Button } from '@trustroots/ui';
import React from 'react';

// Internal dependencies
import MapIcon from './MapIcon';

type MapStyleButtonProps = {
  disabled?: boolean;
  iconStyle?: string;
  label: string;
  onClick: () => void;
  selectedStyle: string | { name: string };
  styleName: string;
  style?: string;
};

export default function MapStyleButton({
  disabled,
  iconStyle = '',
  label,
  onClick,
  selectedStyle,
  styleName,
}: MapStyleButtonProps) {
  return (
    <Button
      variant="default"
      className={selectedStyle === styleName ? 'is-active' : undefined}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <MapIcon mapboxStyle={iconStyle} />
      {label}
    </Button>
  );
}
