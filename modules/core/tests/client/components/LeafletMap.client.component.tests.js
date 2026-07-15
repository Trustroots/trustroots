import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import L from 'leaflet';

import LeafletMap from '@/modules/core/client/components/Map/LeafletMap';

const mockMap = {
  getCenter: jest.fn(),
  getZoom: jest.fn(),
  remove: jest.fn(),
  setView: jest.fn(),
};
mockMap.setView.mockImplementation(() => mockMap);
const mockMarker = { remove: jest.fn() };

jest.mock('leaflet', () => ({
  circleMarker: jest.fn(() => ({
    addTo: jest.fn(() => mockMarker),
  })),
  map: jest.fn(() => mockMap),
  tileLayer: jest.fn(() => ({ addTo: jest.fn() })),
}));

beforeEach(() => {
  mockMap.getCenter.mockReturnValue({ lat: 50.12, lng: 19.89 });
  mockMap.getZoom.mockReturnValue(11);
  mockMap.remove.mockClear();
  mockMap.setView.mockClear();
  mockMarker.remove.mockClear();
  L.circleMarker.mockClear();
  L.map.mockClear();
  L.tileLayer.mockClear();
});

describe('<LeafletMap />', () => {
  it('renders raster tiles and the supplied marker', () => {
    const { container } = render(
      <LeafletMap
        ariaHidden
        className="offer-location"
        location={[50.12, 19.89]}
        marker={{ color: '#11b4da', location: [50.12, 19.89] }}
        scrollZoom={false}
        zoom={11}
      />,
    );

    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    expect(L.map).toHaveBeenCalledWith(expect.any(HTMLDivElement), {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    expect(L.tileLayer).toHaveBeenCalledWith(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.objectContaining({ maxZoom: 19 }),
    );
    expect(L.circleMarker).toHaveBeenCalledWith(
      [50.12, 19.89],
      expect.objectContaining({ fillColor: '#11b4da', radius: 12 }),
    );
  });

  it('follows a changed location and cleans up the map and marker', () => {
    const { rerender, unmount } = render(
      <LeafletMap
        location={[50.12, 19.89]}
        marker={{ color: '#11b4da', location: [50.12, 19.89] }}
        zoom={11}
      />,
    );

    rerender(
      <LeafletMap
        location={[51.12, 20.89]}
        marker={{ color: '#58ba58', location: [51.12, 20.89] }}
        zoom={12}
      />,
    );

    expect(mockMap.setView).toHaveBeenCalledWith([51.12, 20.89], 12);
    expect(mockMarker.remove).toHaveBeenCalled();

    unmount();
    expect(mockMap.remove).toHaveBeenCalledTimes(1);
  });

  it('uses the default zoom and accepts a map without a marker', () => {
    render(<LeafletMap location={[50.12, 19.89]} />);

    expect(mockMap.setView).toHaveBeenCalledWith([50.12, 19.89], 6);
    expect(L.circleMarker).not.toHaveBeenCalled();
  });

  it('does not update the map when no location is available', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(<LeafletMap location={null} />);

    expect(mockMap.setView).toHaveBeenCalledTimes(1);
    expect(L.circleMarker).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
