// External dependencies
import classnames from 'classnames';
import PropTypes from 'prop-types';
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

MapStyleButton.propTypes = {
  disabled: PropTypes.bool,
  iconStyle: PropTypes.string,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  selectedStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.string])
    .isRequired,
  styleName: PropTypes.string.isRequired,
};
