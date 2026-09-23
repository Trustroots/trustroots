import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import HomeRoute from '@/modules/pages/client/components/HomeRoute';
import { broadcastClientEvent } from '@/modules/core/client/services/client-runtime';

jest.mock('@/modules/pages/client/components/Home.component', () => ({
  __esModule: true,
  default: props => <output>{JSON.stringify(props)}</output>,
}));

it('passes landing queries and bootstrap data and tracks all displayed photos', () => {
  window.history.replaceState({}, '', '/?circle=cyclists&tribe=hitchhikers');
  const { unmount } = render(
    <AppProviders
      bootstrapData={{
        user: null,
        settings: { build: { shortCommit: 'abc123' } },
        isNativeMobileApp: true,
      }}
    >
      <HomeRoute user={null} />
    </AppProviders>,
  );
  expect(screen.getByRole('status')).toHaveTextContent('cyclists');
  expect(screen.getByRole('status')).toHaveTextContent('abc123');
  expect(screen.getByRole('status')).toHaveTextContent(
    '"isNativeMobileApp":true',
  );
  act(() => {
    broadcastClientEvent('photoCreditsUpdated', {
      first: { name: 'First Artist' },
    });
    broadcastClientEvent('photoCreditsUpdated', {
      second: { name: 'Second Artist' },
    });
  });
  expect(screen.getByRole('status')).toHaveTextContent('First Artist');
  expect(screen.getByRole('status')).toHaveTextContent('Second Artist');
  act(() => broadcastClientEvent('photoCreditsRemoved', { first: {} }));
  expect(screen.getByRole('status')).not.toHaveTextContent('First Artist');
  expect(screen.getByRole('status')).toHaveTextContent('Second Artist');
  unmount();
  act(() => broadcastClientEvent('photoCreditsUpdated', { third: {} }));
  window.history.replaceState({}, '', '/');
});
