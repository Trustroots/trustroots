import React from 'react';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import DeviceLocationButton from '@/modules/core/client/components/DeviceLocationButton';
import useDeviceLocation from '@/modules/core/client/utils/use-device-location';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => `i18n:${key}` }),
}));
const mockRequestMapDefaultLocation = jest.fn();
jest.mock('@/modules/core/client/utils/use-map-default-location', () => ({
  __esModule: true,
  requestMapDefaultLocation: (...args: unknown[]) =>
    mockRequestMapDefaultLocation(...args),
}));

type SuccessCallback = PositionCallback;
type ErrorCallback = PositionErrorCallback;

let getCurrentPosition: jest.Mock<
  void,
  [SuccessCallback, ErrorCallback, PositionOptions?]
>;
let originalGeolocation: PropertyDescriptor | undefined;
let originalNavigator: PropertyDescriptor | undefined;

function setGeolocation(value: Geolocation | undefined) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value,
  });
}

function makePosition(
  latitude: number,
  longitude: number,
): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  };
}

beforeEach(() => {
  originalGeolocation = Object.getOwnPropertyDescriptor(
    navigator,
    'geolocation',
  );
  originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  getCurrentPosition = jest.fn();
  setGeolocation({
    getCurrentPosition,
    clearWatch: jest.fn(),
    watchPosition: jest.fn(),
  });
});

afterEach(() => {
  mockRequestMapDefaultLocation.mockReset();
  if (originalNavigator) {
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
  }
  if (originalGeolocation) {
    Object.defineProperty(navigator, 'geolocation', originalGeolocation);
  } else {
    Reflect.deleteProperty(navigator, 'geolocation');
  }
});

it('requests location only after click and sends valid zero coordinates', () => {
  const onLocation = jest.fn();
  const onRequest = jest.fn();
  const sequence: string[] = [];
  onRequest.mockImplementation(() => sequence.push('request'));
  getCurrentPosition.mockImplementation(() => sequence.push('geolocation'));

  render(
    <DeviceLocationButton onLocation={onLocation} onRequest={onRequest} />,
  );

  expect(getCurrentPosition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Use my location' }));

  expect(sequence).toEqual(['request', 'geolocation']);
  expect(getCurrentPosition).toHaveBeenCalledWith(
    expect.any(Function),
    expect.any(Function),
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 },
  );
  act(() => getCurrentPosition.mock.calls[0][0](makePosition(0, 0)));
  expect(onLocation).toHaveBeenCalledWith({ lat: 0, lng: 0 });
});

it('prevents duplicate requests while pending and exposes pending accessibly', () => {
  render(<DeviceLocationButton onLocation={jest.fn()} />);
  const button = screen.getByRole('button', {
    name: 'i18n:Use my location',
  });
  fireEvent.click(button);

  expect(
    screen.getByRole('button', { name: 'i18n:Finding your location…' }),
  ).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent(
    'i18n:Finding your location…',
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'i18n:Finding your location…' }),
  );
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
});

it.each([
  [
    1,
    'i18n:Location access was denied. Enable location permissions in your browser settings, or choose a location manually.',
  ],
  [
    2,
    'i18n:Your location is unavailable. Try again, or choose a location manually.',
  ],
  [
    3,
    'i18n:The location request timed out. Try again, or choose a location manually.',
  ],
  [
    99,
    'i18n:Your location is unavailable. Try again, or choose a location manually.',
  ],
])('announces geolocation error code %s', (code, message) => {
  render(<DeviceLocationButton onLocation={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Use my location' }));
  act(() =>
    getCurrentPosition.mock.calls[0][1]({ code } as GeolocationPositionError),
  );

  expect(screen.getByRole('status')).toHaveTextContent(message);
  expect(
    screen.getByRole('button', { name: 'i18n:Use my location' }),
  ).toBeEnabled();
});

it('reports unsupported browsers without asking for a position', () => {
  setGeolocation(undefined);
  const onRequest = jest.fn();
  render(<DeviceLocationButton onLocation={jest.fn()} onRequest={onRequest} />);
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Use my location' }));

  expect(onRequest).toHaveBeenCalledTimes(1);
  expect(getCurrentPosition).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent(
    'i18n:Location is not supported by this browser. Choose a location manually.',
  );
});

it.each([
  [Number.NaN, 1],
  [91, 1],
  [-91, 1],
  [1, Number.POSITIVE_INFINITY],
  [1, 181],
  [1, -181],
])('rejects invalid coordinates (%s, %s)', (lat, lng) => {
  const onLocation = jest.fn();
  render(<DeviceLocationButton onLocation={onLocation} />);
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Use my location' }));
  act(() => getCurrentPosition.mock.calls[0][0](makePosition(lat, lng)));

  expect(onLocation).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent(
    'i18n:Your location is unavailable. Try again, or choose a location manually.',
  );
});

it('reports a synchronous browser failure', () => {
  getCurrentPosition.mockImplementation(() => {
    throw new Error('browser failure');
  });
  render(<DeviceLocationButton onLocation={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Use my location' }));

  expect(screen.getByRole('status')).toHaveTextContent(
    'i18n:Your location is unavailable. Try again, or choose a location manually.',
  );
});

it('ignores callbacks after unmount', () => {
  const onLocation = jest.fn();
  const { unmount } = render(<DeviceLocationButton onLocation={onLocation} />);
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Use my location' }));
  const success = getCurrentPosition.mock.calls[0][0];
  const failure = getCurrentPosition.mock.calls[0][1];

  unmount();
  act(() => success(makePosition(12, 34)));
  act(() => failure({ code: 1 } as GeolocationPositionError));

  expect(onLocation).not.toHaveBeenCalled();
});

it('clears an error when retrying and uses the latest location handler', () => {
  const firstHandler = jest.fn();
  const latestHandler = jest.fn();
  const { rerender } = render(
    <DeviceLocationButton onLocation={firstHandler} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Use my location' }));
  act(() =>
    getCurrentPosition.mock.calls[0][1]({
      code: 1,
    } as GeolocationPositionError),
  );

  rerender(<DeviceLocationButton onLocation={latestHandler} />);
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Use my location' }));
  expect(screen.getByRole('status')).toHaveTextContent(
    'i18n:Finding your location…',
  );
  act(() => getCurrentPosition.mock.calls[1][0](makePosition(45, 12)));

  expect(firstHandler).not.toHaveBeenCalled();
  expect(latestHandler).toHaveBeenCalledWith({ lat: 45, lng: 12 });
});

it('ignores duplicate browser callbacks for one request', () => {
  const onLocation = jest.fn();
  render(<DeviceLocationButton onLocation={onLocation} />);
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Use my location' }));
  const success = getCurrentPosition.mock.calls[0][0];
  act(() => success(makePosition(45, 12)));
  act(() => success(makePosition(46, 13)));

  expect(onLocation).toHaveBeenCalledTimes(1);
  expect(onLocation).toHaveBeenCalledWith({ lat: 45, lng: 12 });
});

it('guards against duplicate requests at the hook boundary', () => {
  const { result } = renderHook(() => useDeviceLocation(jest.fn()));
  act(() => {
    result.current.requestLocation();
    result.current.requestLocation();
  });

  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
});

it('handles an environment without navigator', () => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: undefined,
  });
  const { result } = renderHook(() => useDeviceLocation(jest.fn()));
  act(() => result.current.requestLocation());

  expect(result.current.error).toBe('unsupported');
  expect(result.current.status).toBe('error');
});

it('ignores a failure callback after unmount', () => {
  const { result, unmount } = renderHook(() => useDeviceLocation(jest.fn()));
  act(() => result.current.requestLocation());
  const failure = getCurrentPosition.mock.calls[0][1];

  unmount();
  act(() => failure({ code: 1 } as GeolocationPositionError));

  expect(result.current.status).toBe('pending');
});

it('does not update hook state if a synchronous browser failure follows unmount', () => {
  const { result, unmount } = renderHook(() => useDeviceLocation(jest.fn()));
  getCurrentPosition.mockImplementation(() => {
    unmount();
    throw new Error('browser failure');
  });

  act(() => result.current.requestLocation());

  expect(result.current.status).toBe('idle');
});

it('ignores a thrown error after a success callback has completed', () => {
  const onLocation = jest.fn();
  getCurrentPosition.mockImplementation(success => {
    success(makePosition(45, 12));
    throw new Error('late browser failure');
  });
  render(<DeviceLocationButton onLocation={onLocation} />);
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Use my location' }));

  expect(onLocation).toHaveBeenCalledWith({ lat: 45, lng: 12 });
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

it('uses and attributes the approximate location after a device error', async () => {
  const approximate = { latitude: 34, longitude: -17, zoom: 6 };
  mockRequestMapDefaultLocation.mockResolvedValue(approximate);
  const onLocation = jest.fn();
  const onApproximateLocation = jest.fn();
  render(
    <DeviceLocationButton
      onLocation={onLocation}
      onApproximateLocation={onApproximateLocation}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Use my location' }));
  act(() =>
    getCurrentPosition.mock.calls[0][1]({
      code: 1,
    } as GeolocationPositionError),
  );
  await act(async () => {});

  expect(mockRequestMapDefaultLocation).toHaveBeenCalledTimes(1);
  expect(onApproximateLocation).toHaveBeenCalledWith(approximate);
  expect(onLocation).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent(
    'i18n:Showing your approximate location.',
  );
  expect(screen.getByRole('link', { name: 'MaxMind' })).toHaveAttribute(
    'href',
    'https://www.maxmind.com',
  );
});

it('stays pending while the approximate location is loading', async () => {
  let resolveApproximate!: (value: {
    latitude: number;
    longitude: number;
    zoom: number;
  }) => void;
  mockRequestMapDefaultLocation.mockReturnValue(
    new Promise(resolve => {
      resolveApproximate = resolve;
    }),
  );
  const onApproximateLocation = jest.fn();
  render(
    <DeviceLocationButton
      onLocation={jest.fn()}
      onApproximateLocation={onApproximateLocation}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Use my location' }));
  act(() =>
    getCurrentPosition.mock.calls[0][1]({
      code: 3,
    } as GeolocationPositionError),
  );

  expect(
    screen.getByRole('button', { name: 'i18n:Finding your location…' }),
  ).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent(
    'i18n:Finding your location…',
  );
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolveApproximate({ latitude: 34, longitude: -17, zoom: 6 });
  });
  expect(onApproximateLocation).toHaveBeenCalledTimes(1);
});

it('retains the device error when the approximate location is unavailable', async () => {
  mockRequestMapDefaultLocation.mockResolvedValue(null);
  render(
    <DeviceLocationButton
      onLocation={jest.fn()}
      onApproximateLocation={jest.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Use my location' }));
  act(() =>
    getCurrentPosition.mock.calls[0][1]({
      code: 1,
    } as GeolocationPositionError),
  );
  await act(async () => {});

  expect(screen.getByRole('status')).toHaveTextContent(
    'i18n:Location access was denied. Enable location permissions in your browser settings, or choose a location manually.',
  );
});

it('ignores a late approximate response after unmount', async () => {
  let resolveApproximate!: (value: {
    latitude: number;
    longitude: number;
    zoom: number;
  }) => void;
  mockRequestMapDefaultLocation.mockReturnValue(
    new Promise(resolve => {
      resolveApproximate = resolve;
    }),
  );
  const onApproximateLocation = jest.fn();
  const { unmount } = render(
    <DeviceLocationButton
      onLocation={jest.fn()}
      onApproximateLocation={onApproximateLocation}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Use my location' }));
  act(() =>
    getCurrentPosition.mock.calls[0][1]({
      code: 2,
    } as GeolocationPositionError),
  );

  unmount();
  await act(async () => {
    resolveApproximate({ latitude: 34, longitude: -17, zoom: 6 });
  });
  expect(onApproximateLocation).not.toHaveBeenCalled();
});
