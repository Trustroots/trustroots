import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import SearchPlaceInput from '@/modules/search/client/components/SearchPlaceInput.component';
import * as locationApi from '@/modules/search/client/api/location.api';

type InputProps = React.ComponentProps<typeof SearchPlaceInput>;
type PlaceSuggestion = Awaited<
  ReturnType<typeof locationApi.fetchLocationSuggestions>
>[number];
const locationApiMock = jest.mocked(locationApi);

jest.mock('@/modules/search/client/api/location.api');
jest.mock('use-debounce', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    useDebouncedCallback<Args extends unknown[], Result>(
      callback: (...args: Args) => Result,
    ) {
      const callbackRef = React.useRef(callback);
      callbackRef.current = callback;

      const stable = React.useCallback(
        (...args: Args) => callbackRef.current(...args),
        [],
      );

      return stable;
    },
  };
});

describe('SearchPlaceInput', () => {
  const onPlaceSearch = jest.fn<
    ReturnType<InputProps['onPlaceSearch']>,
    Parameters<InputProps['onPlaceSearch']>
  >();
  const setSearchQuery = jest.fn<
    ReturnType<InputProps['setSearchQuery']>,
    Parameters<InputProps['setSearchQuery']>
  >();

  beforeEach(() => {
    jest.clearAllMocks();
    locationApiMock.fetchLocationSuggestions.mockResolvedValue([]);
    locationApiMock.locatePlace.mockReturnValue(null);
  });

  function renderInput(searchQuery = '') {
    return render(
      <SearchPlaceInput
        onPlaceSearch={onPlaceSearch}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />,
    );
  }

  it('renders the place search input', () => {
    renderInput();

    expect(screen.getByLabelText('Search places')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search Places')).toBeInTheDocument();
  });

  it('updates the search query when typing', () => {
    renderInput('Par');

    fireEvent.change(screen.getByLabelText('Search places'), {
      target: { value: 'Paris' },
    });

    expect(setSearchQuery).toHaveBeenCalledWith('Paris');
  });

  it('clears the search query when the clear button is clicked', () => {
    renderInput('Helsinki');

    fireEvent.click(
      screen.getByRole('button', { name: 'Clear location search' }),
    );

    expect(setSearchQuery).toHaveBeenCalledWith('');
  });

  it('disables clear for an empty query', () => {
    renderInput();

    expect(
      screen.getByRole('button', { name: 'Clear location search' }),
    ).toBeDisabled();
  });

  it('loads suggestions when the query is at least three characters', async () => {
    locationApiMock.fetchLocationSuggestions.mockResolvedValue([
      { id: 'place-1', trTitle: 'Paris, France' },
    ]);

    renderInput('Par');

    await waitFor(() => {
      expect(locationApi.fetchLocationSuggestions).toHaveBeenCalledWith('Par');
    });

    expect(
      await screen.findByRole('option', { name: 'Paris, France' }),
    ).toBeInTheDocument();
  });

  it('does not load suggestions for very short queries', async () => {
    renderInput('Pa');

    await waitFor(() => {
      expect(locationApi.fetchLocationSuggestions).not.toHaveBeenCalled();
    });
  });

  it('selects a suggestion and notifies the parent', async () => {
    const feature: PlaceSuggestion = {
      id: 'place-1',
      trTitle: 'Paris, France',
    };
    locationApiMock.fetchLocationSuggestions.mockResolvedValue([feature]);
    locationApiMock.locatePlace.mockReturnValue({
      data: { lat: 48.8566, lng: 2.3522 },
      type: 'center',
    });

    renderInput('Par');

    fireEvent.click(
      await screen.findByRole('option', { name: 'Paris, France' }),
    );

    expect(locationApi.locatePlace).toHaveBeenCalledWith(feature);
    expect(onPlaceSearch).toHaveBeenCalledWith(
      { lat: 48.8566, lng: 2.3522 },
      'center',
    );
    expect(setSearchQuery).toHaveBeenCalledWith('Paris, France');
  });

  it('keeps the query when a suggestion cannot be located', async () => {
    locationApiMock.fetchLocationSuggestions.mockResolvedValue([
      { id: 'place-unlocated', trTitle: 'Unknown place' },
    ]);
    locationApiMock.locatePlace.mockReturnValue(null);

    renderInput('Unk');
    fireEvent.click(
      await screen.findByRole('option', { name: 'Unknown place' }),
    );

    expect(onPlaceSearch).not.toHaveBeenCalled();
    expect(setSearchQuery).toHaveBeenCalledWith('Unknown place');
  });

  it('auto-selects the first suggestion when Enter is pressed', async () => {
    const feature: PlaceSuggestion = {
      id: 'place-2',
      trTitle: 'Helsinki, Finland',
    };
    locationApiMock.fetchLocationSuggestions.mockResolvedValue([feature]);
    locationApiMock.locatePlace.mockReturnValue({
      data: { lat: 60.17, lng: 24.94 },
      type: 'center',
    });

    renderInput('Hel');

    const input = screen.getByLabelText('Search places');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onPlaceSearch).toHaveBeenCalledWith(
        { lat: 60.17, lng: 24.94 },
        'center',
      );
    });
    expect(setSearchQuery).toHaveBeenCalledWith('Helsinki, Finland');
  });

  it('shows a warning when Enter cannot find a location', async () => {
    locationApiMock.fetchLocationSuggestions.mockResolvedValue([]);

    renderInput('Nowhereville');

    await waitFor(() => {
      expect(locationApi.fetchLocationSuggestions).toHaveBeenCalledWith(
        'Nowhereville',
      );
    });

    locationApiMock.fetchLocationSuggestions.mockResolvedValue([]);

    fireEvent.keyDown(screen.getByLabelText('Search places'), {
      key: 'Enter',
    });

    expect(await screen.findByText(/we could not find/i)).toBeInTheDocument();
    expect(screen.getByText('Nowhereville')).toBeInTheDocument();
  });

  it('closes suggestions when clicking outside the input', async () => {
    locationApiMock.fetchLocationSuggestions.mockResolvedValue([
      { id: 'place-3', trTitle: 'Berlin, Germany' },
    ]);

    renderInput('Ber');

    expect(
      await screen.findByRole('option', { name: 'Berlin, Germany' }),
    ).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(
        screen.queryByRole('option', { name: 'Berlin, Germany' }),
      ).not.toBeInTheDocument();
    });
  });

  it('reopens suggestions on focus when results already exist', async () => {
    locationApiMock.fetchLocationSuggestions.mockResolvedValue([
      { id: 'place-4', trTitle: 'Oslo, Norway' },
    ]);

    renderInput('Osl');

    const input = screen.getByLabelText('Search places');
    await screen.findByRole('option', { name: 'Oslo, Norway' });

    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(
        screen.queryByRole('option', { name: 'Oslo, Norway' }),
      ).not.toBeInTheDocument();
    });

    fireEvent.focus(input);

    expect(
      await screen.findByRole('option', { name: 'Oslo, Norway' }),
    ).toBeInTheDocument();
  });

  it('keeps an empty suggestion list closed for non-search interactions', () => {
    renderInput();

    const input = screen.getByLabelText('Search places');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.mouseDown(input);

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
});
