// External dependencies
import { useMap } from '@vis.gl/react-maplibre';
import { useTranslation } from 'react-i18next';
import React from 'react';

const buttonClassName = 'tw:size-9 tw:rounded-[2px] tw:border-0';

export default function MapNavigationControl() {
  const { t } = useTranslation('core');
  const { current: map } = useMap();

  return (
    <div
      className="tw:absolute tw:top-2.5 tw:right-[45px] tw:z-5"
      role="presentation"
      onMouseDown={event => event.stopPropagation()}
      onDoubleClick={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
    >
      <div className="maplibregl-ctrl maplibregl-ctrl-group tw:rounded-[2px] tw:border-0 tw:bg-white/95 tw:shadow-[0_1px_5px_rgba(0,0,0,0.35)] tw:transition-colors tw:hover:bg-white">
        <button
          type="button"
          className={`maplibregl-ctrl-zoom-in ${buttonClassName}`}
          aria-label={t('Zoom in')}
          onClick={() => map?.zoomIn()}
        >
          <span className="maplibregl-ctrl-icon" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`maplibregl-ctrl-zoom-out ${buttonClassName}`}
          aria-label={t('Zoom out')}
          onClick={() => map?.zoomOut()}
        >
          <span className="maplibregl-ctrl-icon" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
