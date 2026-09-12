import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import HomeRoute from '@/modules/pages/client/components/HomeRoute';
import { $broadcast } from '@/modules/core/client/services/angular-compat';

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
    $broadcast('photoCreditsUpdated', { first: { name: 'First Artist' } });
    $broadcast('photoCreditsUpdated', { second: { name: 'Second Artist' } });
  });
  expect(screen.getByRole('status')).toHaveTextContent('First Artist');
  expect(screen.getByRole('status')).toHaveTextContent('Second Artist');
  act(() => $broadcast('photoCreditsRemoved', { first: {} }));
  expect(screen.getByRole('status')).not.toHaveTextContent('First Artist');
  expect(screen.getByRole('status')).toHaveTextContent('Second Artist');
  unmount();
  act(() => $broadcast('photoCreditsUpdated', { third: {} }));
  window.history.replaceState({}, '', '/');
});
