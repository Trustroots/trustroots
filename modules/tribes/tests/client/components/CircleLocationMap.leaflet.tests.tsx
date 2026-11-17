import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import L from 'leaflet';
import CircleLocationMap from '@/modules/tribes/client/components/CircleLocationMap';
import { AuthProvider } from '@/modules/core/client/react-app/auth';

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
  const { rerender, unmount } = render(<CircleLocationMap {...props} />, {
    wrapper: AuthProvider,
  });
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

it('opens a custom member heading from the keyboard and clears it when closed', () => {
  jest.replaceProperty(L.Browser, 'svg', true);
  const markerSpy = jest.spyOn(L, 'circleMarker');
  const { unmount } = render(
    <CircleLocationMap
      title="Hosting"
      description="Approximate locations"
      mapLabel="Hosting map"
      locations={[
        {
          id: 'example',
          name: 'Sample Host',
          latitude: 0,
          longitude: 0,
          details: [],
          popupHeading: <span>@sample-host</span>,
          link: {
            url: '/profile/sample-host/accommodation',
            label: 'View hosting offer',
          },
        },
      ]}
      state="ready"
      loadingText="Loading"
      emptyText="Empty"
      errorText="Unavailable"
      countLabel="hosts"
    />,
    { wrapper: AuthProvider },
  );

  try {
    const pin = screen.getByRole('button', { name: 'Sample Host' });
    expect(pin).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(pin, { key: 'Tab' });
    expect(screen.queryByText('@sample-host')).not.toBeInTheDocument();
    fireEvent.keyDown(pin, { key: ' ' });
    expect(screen.getByText('@sample-host')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'View hosting offer' }),
    ).toHaveFocus();

    const marker = markerSpy.mock.results[0].value as L.CircleMarker;
    act(() => {
      marker.closePopup();
    });
    expect(screen.queryByText('@sample-host')).not.toBeInTheDocument();
  } finally {
    unmount();
    jest.restoreAllMocks();
  }
});

it('focuses the hosting offer from a pin that is already open', () => {
  jest.replaceProperty(L.Browser, 'svg', true);
  const markerSpy = jest.spyOn(L, 'circleMarker');
  const { unmount } = render(
    <CircleLocationMap
      title="Hosting"
      description="Approximate locations"
      mapLabel="Hosting map"
      locations={[
        {
          id: 'example',
          name: 'Sample Host',
          latitude: 0,
          longitude: 0,
          details: [],
          popupHeading: <span>@sample-host</span>,
          link: {
            url: '/profile/sample-host/accommodation',
            label: 'View hosting offer',
          },
        },
      ]}
      state="ready"
      loadingText="Loading"
      emptyText="Empty"
      errorText="Unavailable"
      countLabel="hosts"
    />,
    { wrapper: AuthProvider },
  );

  try {
    const pin = screen.getByRole('button', { name: 'Sample Host' });
    const marker = markerSpy.mock.results[0].value as L.CircleMarker;
    act(() => {
      marker.openPopup();
    });
    const offer = screen.getByRole('link', { name: 'View hosting offer' });
    expect(screen.getByText('@sample-host')).toBeVisible();
    expect(offer).not.toHaveFocus();

    fireEvent.keyDown(pin, { key: 'Enter' });
    expect(offer).toHaveFocus();
  } finally {
    unmount();
    jest.restoreAllMocks();
  }
});
