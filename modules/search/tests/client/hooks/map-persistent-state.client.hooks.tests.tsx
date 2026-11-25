import type { Mock } from 'vitest';
import React, { useEffect } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

interface MapLocation {
  latitude: number;
  longitude: number;
  zoom: number;
}

const mockMapStateHook = vi.fn();
const mockReact = React;

vi.mock('use-local-storage-state', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: <Value,>(key: string, options: { defaultValue: Value }) => {
      mockMapStateHook(key, options);
      const react = mockReact || ReactActual;
      return [
        ...react.useState(options.defaultValue),
        { removeItem: () => {} },
      ];
    },
  };
});

type UsePersistentMapLocation =
  typeof import('@/modules/search/client/hooks/use-persistent-map-location').default;
let usePersistentMapLocation: UsePersistentMapLocation;
let onMapLocationChange: Mock<(...args: [location: MapLocation]) => void>;

const loadHooks = async () => {
  usePersistentMapLocation = (
    await vi.importActual<
      typeof import('@/modules/search/client/hooks/use-persistent-map-location')
    >('@/modules/search/client/hooks/use-persistent-map-location')
  ).default;
};

function MapLocationTester({ initialValue }: { initialValue: MapLocation }) {
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

describe('search map persistent-state hooks', () => {
  beforeEach(async () => {
    mockMapStateHook.mockClear();
    await loadHooks();

    onMapLocationChange = vi.fn<(...args: [location: MapLocation]) => void>();
  });

  it('persists map location state and updates on setter call', () => {
    const initialLocation = { latitude: 1, longitude: 2, zoom: 3 };
    render(<MapLocationTester initialValue={initialLocation} />);

    expect(mockMapStateHook).toHaveBeenCalledWith('search-map-location', {
      defaultValue: undefined,
    });
    expect(onMapLocationChange).toHaveBeenCalledWith(initialLocation);

    fireEvent.click(screen.getByText('update-location'));

    expect(onMapLocationChange).toHaveBeenLastCalledWith({
      latitude: 9,
      longitude: 10,
      zoom: 11,
    });
  });
});
