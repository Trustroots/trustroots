import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useQueryClient } from '@tanstack/react-query';

import { AppProviders } from '@/layers/shell/client/AppProviders';
import { useBootstrapData } from '@/modules/core/client/react-app/app-context';
import { useAuth } from '@/modules/core/client/react-app/auth';

describe('AppProviders', () => {
  it('throws when bootstrap hooks are used outside the provider', () => {
    function TestConsumer() {
      useBootstrapData();
      return null;
    }

    expect(() => render(<TestConsumer />)).toThrow(
      'useBootstrapData must be used within AppProviders',
    );
  });

  it('provides bootstrap data to children', () => {
    function TestConsumer() {
      const bootstrapData = useBootstrapData();

      return <span>{bootstrapData.title}</span>;
    }

    render(
      <AppProviders
        bootstrapData={{
          settings: {},
          title: 'Bootstrap title',
          user: null,
        }}
      >
        <TestConsumer />
      </AppProviders>,
    );

    expect(screen.getByText('Bootstrap title')).toBeInTheDocument();
  });

  it('reads bootstrap data from window globals by default', () => {
    window.title = 'Window title';

    function TestConsumer() {
      const bootstrapData = useBootstrapData();

      return <span>{bootstrapData.title}</span>;
    }

    render(
      <AppProviders>
        <TestConsumer />
      </AppProviders>,
    );

    expect(screen.getByText('Window title')).toBeInTheDocument();
    delete window.title;
  });

  it('shares core bootstrap, auth and query state across rerenders', () => {
    function Consumer() {
      const { title } = useBootstrapData();
      const { user, setUser } = useAuth();
      const queryClient = useQueryClient();
      React.useEffect(() => () => queryClient.clear(), [queryClient]);
      const cached = queryClient.getQueryData<string>(['provider-state']);

      return (
        <button
          onClick={() => {
            queryClient.setQueryData(['provider-state'], 'retained');
            setUser({ username: 'updated-member' });
          }}
        >
          {title} {user?.username} {cached}
        </button>
      );
    }

    const { rerender } = render(
      <AppProviders
        bootstrapData={{
          settings: {},
          title: 'Initial title',
          user: { username: 'initial-member' },
        }}
      >
        <Consumer />
      </AppProviders>,
    );
    expect(screen.getByRole('button')).toHaveTextContent(
      'Initial title initial-member',
    );
    fireEvent.click(screen.getByRole('button'));
    rerender(
      <AppProviders
        bootstrapData={{
          settings: {},
          title: 'Updated title',
          user: { username: 'replacement-member' },
        }}
      >
        <Consumer />
      </AppProviders>,
    );
    expect(screen.getByRole('button')).toHaveTextContent(
      'Updated title updated-member retained',
    );
  });
});
