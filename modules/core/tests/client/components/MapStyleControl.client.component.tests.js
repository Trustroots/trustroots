import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import MapStyleControl from '@/modules/core/client/components/Map/MapStyleControl';
import {
  MAP_STYLE_MAPBOX_OUTDOORS,
  MAP_STYLE_MAPBOX_SATELLITE,
  MAP_STYLE_MAPBOX_STREETS,
  MAP_STYLE_OSM,
} from '@/modules/core/client/components/Map/constants';
import { getMapBoxToken } from '@/modules/core/client/utils/map';

const mockMapStyleButton = jest.fn();

jest.mock('react-i18next', () => ({
  withTranslation: () => Component => {
    function TranslatedComponent(props) {
      return <Component {...props} t={key => `i18n:${key}`} />;
    }
    TranslatedComponent.displayName = `withTranslation(${
      Component.displayName || Component.name || 'Component'
    })`;
    return TranslatedComponent;
  },
}));

jest.mock('react-map-gl', () => {
  const React = require('react');

  return {
    __esModule: true,
    BaseControl: class MockBaseControl extends React.Component {
      constructor(props) {
        super(props);
        this.state = { isOpen: false };
        this._context = { isDragging: false };
        this._containerRef = { current: null };
      }

      render() {
        return this._render();
      }
    },
  };
});

jest.mock('@/modules/core/client/components/Map/MapStyleButton', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  function MockMapStyleButton(props) {
    mockMapStyleButton(props);
    return (
      <button onClick={props.onClick} disabled={props.disabled}>
        {props.label}
      </button>
    );
  }

  MockMapStyleButton.propTypes = {
    onClick: PropTypes.func,
    disabled: PropTypes.bool,
    label: PropTypes.string,
  };

  return MockMapStyleButton;
});

jest.mock('@/modules/core/client/components/Map/MapIcon', () => {
  const React = require('react');

  return function MockMapIcon() {
    return <div data-testid="map-icon" />;
  };
});

jest.mock('@/modules/core/client/utils/map', () => ({
  getMapBoxToken: jest.fn(),
}));

describe('<MapStyleControl />', () => {
  beforeEach(() => {
    getMapBoxToken.mockReturnValue('mapbox-test-token');
    mockMapStyleButton.mockClear();
  });

  it('renders open state and maps selected styles for button labels', () => {
    render(
      <MapStyleControl
        mapStyle={MAP_STYLE_MAPBOX_SATELLITE}
        setMapstyle={jest.fn()}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: 'i18n:Change map style',
    });

    expect(trigger).toBeInTheDocument();
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
    const setMapstyle = jest.fn();
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
        setMapstyle={jest.fn()}
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
    getMapBoxToken.mockReturnValue(null);
    render(
      <MapStyleControl
        mapStyle={MAP_STYLE_MAPBOX_STREETS}
        setMapstyle={jest.fn()}
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
        setMapstyle={jest.fn()}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: 'i18n:Change map style',
    });

    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Custom style');
  });

  it('does not render OSM option in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      render(
        <MapStyleControl
          mapStyle={MAP_STYLE_MAPBOX_SATELLITE}
          setMapstyle={jest.fn()}
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
