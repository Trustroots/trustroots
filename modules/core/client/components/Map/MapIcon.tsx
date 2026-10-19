import React from 'react';

type MapIconProps = { mapboxStyle?: string };

export default function MapIcon({ mapboxStyle }: MapIconProps) {
  const background = mapboxStyle?.includes('satellite')
    ? '#42594b'
    : mapboxStyle?.includes('outdoors')
      ? '#c6dfb5'
      : '#ece7db';

  return (
    <svg
      className="img-circle"
      aria-hidden="true"
      focusable="false"
      width="24"
      height="24"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="12" fill={background} />
      <path d="M0 17 8 12 15 14 24 7V24H0Z" fill="#8dbcc9" />
      <path
        d="M3 0 10 10 8 24M0 8 10 10 24 17"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
      />
    </svg>
  );
}
