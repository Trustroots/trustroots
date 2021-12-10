// External dependencies
import { NavigationControl } from 'react-map-gl';
import { useTranslation } from 'react-i18next';
import React from 'react';

// Internal dependencies
import './map-navigation-control.less';

export default function MapNavigationControl() {
  const { t } = useTranslation('core');

  return (
    <div className="map-navigation-control-container">
      <NavigationControl
        showCompass={false}
        zoomInLabel={t('Zoom in')}
        zoomOutLabel={t('Zoom out')}
      />
    </div>
  );
}

MapNavigationControl.propTypes = {};
