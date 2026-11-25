import React from 'react';
import { render, screen } from '@testing-library/react';

import Map from '@/modules/core/client/components/Map';
import type { MapProps } from '@/modules/core/client/components/Map/types';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';

const mockIsWebGLSupported = vi.fn<() => boolean>();
vi.mock('@/modules/core/client/utils/map', () => ({
  isWebGLSupported: () => mockIsWebGLSupported(),
}));
vi.mock('@/modules/core/client/components/Map/MapLibreMap', () => ({
  default: (props: MapProps) => (
    <div data-testid="maplibre">{props.children}</div>
  ),
}));
vi.mock('@/modules/core/client/components/Map/LeafletMap', () => ({
  default: (props: MapProps) => (
    <div data-testid="leaflet">{props.children}</div>
  ),
}));

const view = { latitude: 51, longitude: 11, zoom: 5 };

describe('<Map />', () => {
  it('renders MapLibre where WebGL2 is available', async () => {
    mockIsWebGLSupported.mockReturnValue(true);
    const { track, wrapper } = fakeAnalytics();
    render(
      <Map view={view} className="offer-location" style={{ height: 220 }}>
        Map child
      </Map>,
      { wrapper },
    );

    const placeholder = screen.getByRole('alertdialog').parentElement;
    expect(placeholder).toHaveClass('offer-location');
    expect(placeholder).toHaveStyle({ height: '220px' });
    expect(await screen.findByTestId('maplibre')).toHaveTextContent(
      'Map child',
    );
    expect(screen.queryByTestId('leaflet')).not.toBeInTheDocument();
    expect(track).not.toHaveBeenCalled();
  });

  it('falls back to Leaflet without WebGL2 and counts the fallback', async () => {
    mockIsWebGLSupported.mockReturnValue(false);
    const { track, wrapper } = fakeAnalytics();
    render(<Map view={view}>Map child</Map>, { wrapper });

    expect(await screen.findByTestId('leaflet')).toHaveTextContent('Map child');
    expect(screen.queryByTestId('maplibre')).not.toBeInTheDocument();
    expect(track).toHaveBeenCalledExactlyOnceWith('map_raster_fallback');
  });
});
