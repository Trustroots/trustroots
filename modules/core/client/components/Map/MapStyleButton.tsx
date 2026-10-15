// External dependencies
import classnames from 'classnames';
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
    <button
      className={classnames('btn', 'btn-default', {
        'is-active': selectedStyle === styleName,
      })}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <MapIcon mapboxStyle={iconStyle} />
      {label}
    </button>
  );
}
