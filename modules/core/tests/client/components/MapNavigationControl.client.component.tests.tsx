import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MapContext, WebMercatorViewport } from 'react-map-gl';
import '@testing-library/jest-dom';

import MapNavigationControl from '@/modules/core/client/components/Map/MapNavigationControl';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => `i18n:${key}`,
  }),
}));

describe('<MapNavigationControl />', () => {
  it('renders translated zoom buttons without a compass in React 19', () => {
    render(<MapNavigationControl />);
    expect(screen.getByRole('button', { name: 'i18n:Zoom in' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'i18n:Zoom out' })).toBeVisible();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('changes the map zoom when the real navigation buttons are clicked', () => {
    const onViewportChange = jest.fn();
    render(
      <MapContext.Provider
        value={{
          viewport: new WebMercatorViewport({
            width: 640,
            height: 320,
            latitude: 48,
            longitude: 9,
            zoom: 6,
          }),
          onViewportChange,
          map: null,
          container: null,
          isDragging: false,
          eventManager: null,
        }}
      >
        <MapNavigationControl />
      </MapContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'i18n:Zoom in' }));
    expect(onViewportChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ zoom: 7 }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'i18n:Zoom out' }));
    expect(onViewportChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ zoom: 5 }),
    );
  });
});
