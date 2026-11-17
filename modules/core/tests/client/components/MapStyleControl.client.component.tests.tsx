import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import MapStyleControl from '@/modules/core/client/components/Map/MapStyleControl';
import type MapStyleButton from '@/modules/core/client/components/Map/MapStyleButton';
import {
  MAP_STYLE_MAPBOX_OUTDOORS,
  MAP_STYLE_MAPBOX_SATELLITE,
  MAP_STYLE_MAPBOX_STREETS,
  MAP_STYLE_OSM,
} from '@/modules/core/client/components/Map/constants';
import { getMapBoxToken } from '@/modules/core/client/utils/map';

type MapStyleButtonProps = React.ComponentProps<typeof MapStyleButton>;
type MapIconProps = { mapboxStyle?: string };
const mockMapStyleButton =
  vi.fn<(...args: [props: MapStyleButtonProps]) => void>();
const mockMapIcon = vi.fn<(...args: [props: MapIconProps]) => void>();
const mockedGetMapBoxToken = vi.mocked(getMapBoxToken);

vi.mock('react-i18next', () => ({
  withTranslation:
    () =>
    <Props extends object>(Component: React.ComponentType<Props>) => {
      function TranslatedComponent(props: Omit<Props, 't'>) {
        const translatedProps = {
          ...props,
          t: (key: string) => `i18n:${key}`,
        } as Props;
        return <Component {...translatedProps} />;
      }
      TranslatedComponent.displayName = `withTranslation(${
        Component.displayName || Component.name || 'Component'
      })`;
      return TranslatedComponent;
    },
}));

vi.mock('react-map-gl/mapbox', () => ({ useMap: () => ({}) }));

vi.mock('@/modules/core/client/components/Map/MapStyleButton', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  function MockMapStyleButton(props: MapStyleButtonProps) {
    mockMapStyleButton(props);
    return (
      <button onClick={props.onClick} disabled={props.disabled}>
        {props.label}
      </button>
    );
  }

  return { default: MockMapStyleButton };
});

vi.mock('@/modules/core/client/components/Map/MapIcon', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    default: function MockMapIcon(props: MapIconProps) {
      mockMapIcon(props);
      return <div data-testid="map-icon" />;
    },
  };
});

vi.mock('@/modules/core/client/utils/map', () => ({
  getMapBoxToken: vi.fn(),
}));

describe('<MapStyleControl />', () => {
  beforeEach(() => {
    mockedGetMapBoxToken.mockReturnValue('mapbox-test-token');
    mockMapStyleButton.mockClear();
    mockMapIcon.mockClear();
  });

  it('renders open state and maps selected styles for button labels', () => {
    render(
      <MapStyleControl
        mapStyle={MAP_STYLE_MAPBOX_SATELLITE}
        setMapstyle={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: 'i18n:Change map style',
    });

    expect(trigger).toBeInTheDocument();
    fireEvent.mouseDown(trigger);
    fireEvent.doubleClick(trigger);
    expect(trigger).toHaveTextContent('i18n:Satellite');

    fireEvent.click(trigger);

    const streets = screen.getByRole('button', { name: 'i18n:Streets' });
    const outdoors = screen.getByRole('button', { name: 'i18n:Outdoors' });
    const satellite = screen.getByRole('button', { name: 'i18n:Satellite' });

    expect(streets).toBeInTheDocument();
    expect(outdoors).toBeInTheDocument();
    expect(satellite).toBeInTheDocument();

    const osm = screen.getByRole('button', { name: 'OSM' });
    expect(osm).toBeInTheDocument();
  });

  it('updates map style and closes when selecting a style', () => {
    const setMapstyle = vi.fn();
    render(
      <MapStyleControl
        mapStyle={MAP_STYLE_MAPBOX_STREETS}
        setMapstyle={setMapstyle}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'i18n:Change map style',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'i18n:Outdoors' }));

    expect(setMapstyle).toHaveBeenCalledWith(MAP_STYLE_MAPBOX_OUTDOORS);
    expect(
      screen.getByRole('button', { name: 'i18n:Change map style' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'i18n:Change map style' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens on hover and closes on leave', () => {
    render(
      <MapStyleControl
        mapStyle={MAP_STYLE_MAPBOX_STREETS}
        setMapstyle={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: 'i18n:Change map style',
    });

    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole('group')).toBeInTheDocument();

    const group = screen.getByRole('group');
    fireEvent.mouseLeave(group);
    expect(
      screen.getByRole('button', { name: 'i18n:Change map style' }),
    ).toBeInTheDocument();
  });

  it('disables map style buttons when no Mapbox token exists', () => {
    // Preserve the original null token input for this no-token regression.
    Reflect.apply(mockedGetMapBoxToken.mockReturnValue, mockedGetMapBoxToken, [
      null,
    ]);
    render(
      <MapStyleControl
        mapStyle={MAP_STYLE_MAPBOX_STREETS}
        setMapstyle={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'i18n:Change map style',
      }),
    );

    expect(mockMapStyleButton).toHaveBeenCalled();
    const calledWithProps = mockMapStyleButton.mock.calls
      .map(([props]) => props)
      .filter(props => props);

    calledWithProps.forEach(props => {
      expect(props.disabled === undefined ? true : props.disabled).toBe(true);
    });
  });

  it('uses named map style text when an object style is selected', () => {
    render(
      <MapStyleControl
        mapStyle={{ name: 'Custom style' }}
        setMapstyle={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: 'i18n:Change map style',
    });

    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Custom style');
  });

  it('does not pass a mapbox icon style when OSM is selected', () => {
    render(<MapStyleControl mapStyle={MAP_STYLE_OSM} setMapstyle={vi.fn()} />);

    expect(mockMapIcon).toHaveBeenCalledWith(
      expect.objectContaining({
        mapboxStyle: '',
      }),
    );
    expect(
      screen.getByRole('button', { name: 'i18n:Change map style' }),
    ).toHaveTextContent(MAP_STYLE_OSM.name);
  });

  it('updates to OSM style and closes when selecting OSM', () => {
    const setMapstyle = vi.fn();
    render(
      <MapStyleControl
        mapStyle={MAP_STYLE_MAPBOX_STREETS}
        setMapstyle={setMapstyle}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'i18n:Change map style',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: MAP_STYLE_OSM.name }));

    expect(setMapstyle).toHaveBeenCalledWith(MAP_STYLE_OSM);
    expect(
      screen.getByRole('button', { name: 'i18n:Change map style' }),
    ).toBeInTheDocument();
  });

  it('does not render OSM option in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      render(
        <MapStyleControl
          mapStyle={MAP_STYLE_MAPBOX_SATELLITE}
          setMapstyle={vi.fn()}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', {
          name: 'i18n:Change map style',
        }),
      );

      expect(
        screen.queryByRole('button', { name: MAP_STYLE_OSM.name }),
      ).not.toBeInTheDocument();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
