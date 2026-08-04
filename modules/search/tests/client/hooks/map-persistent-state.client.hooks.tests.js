import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

const getMockMapStateHook = () =>
  global.__mockMapStateHookMock || (global.__mockMapStateHookMock = jest.fn());

jest.mock('use-local-storage-state', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (key, options) => {
      const mock = getMockMapStateHook();
      mock(key, options);
      const react = global.__mockReact || React;
      return react.useState(options.defaultValue);
    },
  };
});

beforeAll(() => {
  global.__mockReact = React;
});

let usePersistentMapLocation;
let usePersistentMapStyle;
let onMapLocationChange = jest.fn();
let onMapStyleChange = jest.fn();

const loadHooks = () => {
  jest.resetModules();
  ({
    default: usePersistentMapLocation,
  } = require('@/modules/search/client/hooks/use-persistent-map-location'));
  ({
    default: usePersistentMapStyle,
  } = require('@/modules/search/client/hooks/use-persistent-map-style'));
};

function MapLocationTester({ initialValue }) {
  const [location, setLocation] = usePersistentMapLocation(initialValue);

  useEffect(() => {
    onMapLocationChange(location);
  }, [location, setLocation]);

  return (
    <button
      onClick={() => setLocation({ latitude: 9, longitude: 10, zoom: 11 })}
    >
      update-location
    </button>
  );
}

MapLocationTester.propTypes = {
  initialValue: PropTypes.object.isRequired,
};

function MapStyleTester({ initialValue }) {
  const [style, setStyle] = usePersistentMapStyle(initialValue);

  useEffect(() => {
    onMapStyleChange(style);
  }, [style, setStyle]);

  return (
    <button onClick={() => setStyle('satellite-streets')}>update-style</button>
  );
}

MapStyleTester.propTypes = {
  initialValue: PropTypes.string.isRequired,
};

describe('search map persistent-state hooks', () => {
  beforeEach(() => {
    getMockMapStateHook().mockClear();
    loadHooks();

    onMapLocationChange = jest.fn();
    onMapStyleChange = jest.fn();
  });

  it('persists map location state and updates on setter call', () => {
    const initialLocation = { latitude: 1, longitude: 2, zoom: 3 };
    render(<MapLocationTester initialValue={initialLocation} />);

    expect(getMockMapStateHook()).toHaveBeenCalledWith('search-map-location', {
      defaultValue: initialLocation,
    });
    expect(onMapLocationChange).toHaveBeenCalledWith(initialLocation);

    fireEvent.click(screen.getByText('update-location'));

    expect(onMapLocationChange).toHaveBeenLastCalledWith({
      latitude: 9,
      longitude: 10,
      zoom: 11,
    });
  });

  it('persists map style state and updates on setter call', () => {
    render(<MapStyleTester initialValue="streets" />);

    expect(getMockMapStateHook()).toHaveBeenCalledWith('search-map-style', {
      defaultValue: 'streets',
    });
    expect(onMapStyleChange).toHaveBeenCalledWith('streets');

    fireEvent.click(screen.getByText('update-style'));

    expect(onMapStyleChange).toHaveBeenLastCalledWith('satellite-streets');
  });
});
