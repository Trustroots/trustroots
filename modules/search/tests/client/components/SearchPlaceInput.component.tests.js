import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import SearchPlaceInput from '@/modules/search/client/components/SearchPlaceInput.component';
import * as locationApi from '@/modules/search/client/api/location.api';

jest.mock('@/modules/search/client/api/location.api');
jest.mock('use-debounce', () => {
  const React = require('react');

  return {
    useDebouncedCallback: callback => {
      const callbackRef = React.useRef(callback);
      callbackRef.current = callback;

      const stable = React.useCallback(
        (...args) => callbackRef.current(...args),
        [],
      );

      return [stable];
    },
  };
});

describe('SearchPlaceInput', () => {
  const onPlaceSearch = jest.fn();
  const setSearchQuery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    locationApi.fetchLocationSuggestions.mockResolvedValue([]);
    locationApi.locatePlace.mockReturnValue(null);
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
    locationApi.fetchLocationSuggestions.mockResolvedValue([
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
    const feature = {
      id: 'place-1',
      trTitle: 'Paris, France',
    };
    locationApi.fetchLocationSuggestions.mockResolvedValue([feature]);
    locationApi.locatePlace.mockReturnValue({
      data: { lat: 48.8566, lng: 2.3522, zoom: 10 },
      type: 'center',
    });

    renderInput('Par');

    fireEvent.click(
      await screen.findByRole('option', { name: 'Paris, France' }),
    );

    expect(locationApi.locatePlace).toHaveBeenCalledWith(feature);
    expect(onPlaceSearch).toHaveBeenCalledWith(
      { lat: 48.8566, lng: 2.3522, zoom: 10 },
      'center',
    );
    expect(setSearchQuery).toHaveBeenCalledWith('Paris, France');
  });

  it('keeps the query when a suggestion cannot be located', async () => {
    locationApi.fetchLocationSuggestions.mockResolvedValue([
      { id: 'place-unlocated', trTitle: 'Unknown place' },
    ]);
    locationApi.locatePlace.mockReturnValue(null);

    renderInput('Unk');
    fireEvent.click(
      await screen.findByRole('option', { name: 'Unknown place' }),
    );

    expect(onPlaceSearch).not.toHaveBeenCalled();
    expect(setSearchQuery).toHaveBeenCalledWith('Unknown place');
  });

  it('auto-selects the first suggestion when Enter is pressed', async () => {
    const feature = {
      id: 'place-2',
      trTitle: 'Helsinki, Finland',
    };
    locationApi.fetchLocationSuggestions.mockResolvedValue([feature]);
    locationApi.locatePlace.mockReturnValue({
      data: { lat: 60.17, lng: 24.94, zoom: 10 },
      type: 'center',
    });

    renderInput('Hel');

    const input = screen.getByLabelText('Search places');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onPlaceSearch).toHaveBeenCalledWith(
        { lat: 60.17, lng: 24.94, zoom: 10 },
        'center',
      );
    });
    expect(setSearchQuery).toHaveBeenCalledWith('Helsinki, Finland');
  });

  it('shows a warning when Enter cannot find a location', async () => {
    locationApi.fetchLocationSuggestions.mockResolvedValue([]);

    renderInput('Nowhereville');

    await waitFor(() => {
      expect(locationApi.fetchLocationSuggestions).toHaveBeenCalledWith(
        'Nowhereville',
      );
    });

    locationApi.fetchLocationSuggestions.mockResolvedValue([]);

    fireEvent.keyDown(screen.getByLabelText('Search places'), {
      key: 'Enter',
    });

    expect(await screen.findByText(/we could not find/i)).toBeInTheDocument();
    expect(screen.getByText('Nowhereville')).toBeInTheDocument();
  });

  it('closes suggestions when clicking outside the input', async () => {
    locationApi.fetchLocationSuggestions.mockResolvedValue([
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
    locationApi.fetchLocationSuggestions.mockResolvedValue([
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
