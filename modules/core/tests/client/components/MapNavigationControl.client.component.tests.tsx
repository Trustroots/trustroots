import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import MapNavigationControl from '@/modules/core/client/components/Map/MapNavigationControl';

const mockMap = { zoomIn: jest.fn(), zoomOut: jest.fn() };
let mockCurrentMap: typeof mockMap | undefined = mockMap;
jest.mock('react-map-gl/mapbox', () => ({
  useMap: () => ({ current: mockCurrentMap }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => `i18n:${key}` }),
}));

it('renders translated zoom buttons and controls the current map', () => {
  render(<MapNavigationControl />);
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Zoom in' }));
  fireEvent.mouseDown(screen.getByRole('button', { name: 'i18n:Zoom in' }));
  fireEvent.doubleClick(screen.getByRole('button', { name: 'i18n:Zoom in' }));
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Zoom out' }));
  expect(screen.getAllByRole('button')).toHaveLength(2);
  expect(mockMap.zoomIn).toHaveBeenCalledTimes(1);
  expect(mockMap.zoomOut).toHaveBeenCalledTimes(1);
});

it('keeps navigation safe before a map is available', () => {
  mockCurrentMap = undefined;
  render(<MapNavigationControl />);
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Zoom in' }));
  fireEvent.click(screen.getByRole('button', { name: 'i18n:Zoom out' }));
  mockCurrentMap = mockMap;
});
