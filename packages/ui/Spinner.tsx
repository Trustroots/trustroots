import React from 'react';
import './primitives.css';

export function Spinner({ label }: { label: string }) {
  return (
    <span className="tr-spinner" role="status">
      <span className="tr-spinner__label">{label}</span>
    </span>
  );
}
