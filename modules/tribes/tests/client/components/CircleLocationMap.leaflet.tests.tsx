import React from 'react';
import { act, render } from '@testing-library/react';
import L from 'leaflet';
import CircleLocationMap from '@/modules/tribes/client/components/CircleLocationMap';

jest.mock('@/modules/core/client/utils/map', () => ({
  getRasterMapTiles: () => ({
    url: 'https://tiles.test/{z}/{x}/{y}',
    options: {},
  }),
}));

it('preserves a panned view when restoring a popup, but pans on an explicit reopen', () => {
  jest.replaceProperty(L.Browser, 'svg', true);
  const mapSpy = jest.spyOn(L, 'map');
  const markerSpy = jest.spyOn(L, 'circleMarker');
  const location = {
    id: 'example',
    name: 'Example ride',
    latitude: 0,
    longitude: 0,
    details: [],
  };
  const props = {
    title: 'Rides',
    description: 'Recent rides',
    mapLabel: 'Rides map',
    locations: [location],
    state: 'ready' as const,
    loadingText: 'Loading',
    emptyText: 'Empty',
    errorText: 'Unavailable',
    countLabel: 'rides',
  };
  const { rerender, unmount } = render(<CircleLocationMap {...props} />);
  try {
    const map = mapSpy.mock.results[0].value as L.Map;
    Object.defineProperties(map.getContainer(), {
      clientWidth: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 600 },
    });
    act(() => {
      map.invalidateSize();
      map.setView([0, 0], 4, { animate: false });
      markerSpy.mock.results[0].value.openPopup();
      map.panTo([0, 100], { animate: false });
    });
    const centre = map.getCenter();
    const pan = jest.spyOn(map, 'panBy').mockReturnValue(map);
    rerender(<CircleLocationMap {...props} locations={[{ ...location }]} />);
    const replacement = markerSpy.mock.results[1].value as L.CircleMarker;
    expect(replacement.isPopupOpen()).toBe(true);
    expect(map.getCenter()).toEqual(centre);
    expect(pan).not.toHaveBeenCalled();
    act(() => {
      replacement.closePopup();
      replacement.openPopup();
    });
    expect(pan).toHaveBeenCalled();
  } finally {
    unmount();
    jest.restoreAllMocks();
  }
});
