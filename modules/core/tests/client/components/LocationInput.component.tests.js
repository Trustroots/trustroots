import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import axios from 'axios';
import LocationInput from '@/modules/core/client/components/LocationInput.component';

jest.mock('axios');

jest.mock('@/modules/core/client/react-app/AppProviders', () => ({
  useSettings: jest.fn(() => ({
    mapbox: { publicKey: 'pk.test-mapbox-token' },
  })),
}));

const { useSettings } = require('@/modules/core/client/react-app/AppProviders');

describe('<LocationInput />', () => {
  const onChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useSettings.mockReturnValue({
      mapbox: { publicKey: 'pk.test-mapbox-token' },
    });
    axios.get.mockResolvedValue({ data: { features: [] } });
  });

  it('renders with the provided value and placeholder', () => {
    render(
      <LocationInput
        id="location-input"
        onChange={onChange}
        placeholder="Where are you?"
        value="Helsinki"
      />,
    );

    expect(screen.getByPlaceholderText('Where are you?')).toHaveValue(
      'Helsinki',
    );
  });

  it('notifies the parent when the query changes', () => {
    render(<LocationInput id="location-input" onChange={onChange} value="" />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Ber' },
    });

    expect(onChange).toHaveBeenCalledWith('Ber');
  });

  it('loads suggestions when the input is focused and typed into', async () => {
    axios.get.mockResolvedValue({
      data: {
        features: [
          {
            id: 'place.1',
            text: 'Berlin',
            place_name: 'Berlin, Germany',
            context: [{ id: 'country.1', text: 'Germany' }],
          },
        ],
      },
    });

    render(<LocationInput id="location-input" onChange={onChange} value="" />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Berlin' },
    });

    expect(
      await screen.findByRole('button', { name: 'Berlin, Germany' }),
    ).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('mapbox.places/Berlin.json'),
    );
  });

  it('selects a suggestion and closes the list', async () => {
    const feature = {
      id: 'place.2',
      text: 'Paris',
      place_name: 'Paris, France',
      context: [{ id: 'country.2', text: 'France' }],
    };
    axios.get.mockResolvedValue({ data: { features: [feature] } });

    render(<LocationInput id="location-input" onChange={onChange} value="" />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Paris' },
    });

    fireEvent.mouseDown(
      await screen.findByRole('button', { name: 'Paris, France' }),
    );

    expect(onChange).toHaveBeenCalledWith(
      'Paris, France',
      expect.objectContaining({
        id: 'place.2',
        trTitle: 'Paris, France',
      }),
    );
    expect(screen.getByRole('textbox')).toHaveValue('Paris, France');
  });

  it('uses the full place name for US locations', async () => {
    axios.get.mockResolvedValue({
      data: {
        features: [
          {
            id: 'place.3',
            text: 'Austin',
            place_name: 'Austin, Texas, United States',
            context: [
              { id: 'place.3', text: 'Austin' },
              {
                id: 'country.3',
                text: 'United States',
                short_code: 'us',
              },
            ],
          },
        ],
      },
    });

    render(<LocationInput id="location-input" onChange={onChange} value="" />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Austin' },
    });

    expect(
      await screen.findByRole('button', {
        name: 'Austin, Texas, United States',
      }),
    ).toBeInTheDocument();
  });

  it('does not fetch suggestions for very short queries', async () => {
    render(<LocationInput id="location-input" onChange={onChange} value="A" />);

    fireEvent.focus(screen.getByRole('textbox'));

    await waitFor(() => {
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  it('limits location types when requested', async () => {
    render(
      <LocationInput
        id="location-input"
        limitLocationTypes
        onChange={onChange}
        value=""
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Oslo' },
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining(
          'types=country,region,place,locality,neighborhood',
        ),
      );
    });
  });

  it('syncs the local query when the value prop changes', () => {
    const { rerender } = render(
      <LocationInput id="location-input" onChange={onChange} value="First" />,
    );

    rerender(
      <LocationInput id="location-input" onChange={onChange} value="Second" />,
    );

    expect(screen.getByRole('textbox')).toHaveValue('Second');
  });

  it('returns no suggestions when mapbox is not configured', async () => {
    useSettings.mockReturnValue({ mapbox: {} });

    render(
      <LocationInput id="location-input" onChange={onChange} value="Test" />,
    );

    fireEvent.focus(screen.getByRole('textbox'));

    await waitFor(() => {
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  it('builds titles from place context items', async () => {
    axios.get.mockResolvedValue({
      data: {
        features: [
          {
            id: 'place.4',
            text: 'Lyon',
            place_name: 'Lyon, France',
            context: [
              { id: 'place.4', text: 'Rhône' },
              { id: 'country.4', text: 'France' },
            ],
          },
        ],
      },
    });

    render(<LocationInput id="location-input" onChange={onChange} value="" />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Lyon' },
    });

    expect(
      await screen.findByRole('button', { name: 'Lyon, Rhône, France' }),
    ).toBeInTheDocument();
  });

  it('falls back to place_name when a feature has no short text', async () => {
    axios.get.mockResolvedValue({
      data: {
        features: [
          {
            id: 'place.5',
            place_name: 'Springfield, Illinois, United States',
          },
        ],
      },
    });

    render(<LocationInput id="location-input" onChange={onChange} value="" />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Spring' },
    });

    expect(
      await screen.findByRole('button', {
        name: 'Springfield, Illinois, United States',
      }),
    ).toBeInTheDocument();
  });

  it('handles non-US and empty location contexts', async () => {
    axios.get.mockResolvedValue({
      data: {
        features: [
          {
            id: 'place.7',
            text: 'Madrid',
            place_name: 'Madrid, Spain',
            context: [{ id: 'country.7', text: 'Spain', short_code: 'es' }],
          },
          { id: 'place.8', text: 'Unknown', context: [] },
          {
            id: 'place.9',
            text: 'Bergen',
            context: [{ id: 'region.9', text: 'Vestland' }],
          },
        ],
      },
    });

    render(<LocationInput id="location-input" onChange={onChange} value="" />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Madrid' },
    });

    expect(
      await screen.findByRole('button', { name: 'Madrid, Spain' }),
    ).toBeVisible();
  });

  it('handles missing feature lists, default values, and late suggestions', async () => {
    axios.get.mockResolvedValueOnce({ data: {} });
    const firstRender = render(
      <LocationInput id="location-input" onChange={onChange} />,
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Oslo' },
    });
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(screen.getByRole('textbox')).toHaveValue('Oslo');
    firstRender.unmount();

    let resolveSuggestions;
    axios.get.mockReturnValue(
      new Promise(resolve => {
        resolveSuggestions = resolve;
      }),
    );
    const secondRender = render(
      <LocationInput id="second-location-input" onChange={onChange} />,
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Paris' },
    });
    secondRender.unmount();
    resolveSuggestions({ data: { features: [] } });

    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('closes suggestions after the input loses focus', async () => {
    axios.get.mockResolvedValue({
      data: {
        features: [{ id: 'place.6', text: 'Rome', place_name: 'Rome, Italy' }],
      },
    });

    render(<LocationInput id="location-input" onChange={onChange} value="" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Rome' } });
    expect(await screen.findByRole('button', { name: 'Rome' })).toBeVisible();

    fireEvent.blur(input);
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Rome' }),
      ).not.toBeInTheDocument();
    });
  });

  it('selects a place name when a suggestion has no context', async () => {
    axios.get.mockResolvedValue({
      data: {
        features: [{ id: 'place.10', text: 'Rome', place_name: 'Rome, Italy' }],
      },
    });
    render(<LocationInput id="location-input" onChange={onChange} value="" />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Rome' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Rome' }));

    expect(onChange).toHaveBeenCalled();
  });

  it('selects a suggestion with no location context or place name', async () => {
    axios.get.mockResolvedValue({
      data: {
        features: [{ id: 'place.11', text: 'Unknown' }],
      },
    });
    render(<LocationInput id="location-input" onChange={onChange} value="" />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Unknown' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Unknown' }));

    expect(onChange).toHaveBeenCalled();
  });
});
