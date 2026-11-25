import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, useQueryClient } from '@tanstack/react-query';

import { AppProviders } from '@/layers/shell/client/AppProviders';
import { useBootstrapData } from '@trustroots/core/app-context';
import { useAuth } from '@trustroots/core/auth';
import { useBootstrapData as useDirectBootstrapData } from '@/modules/core/client/react-app/app-context';
import { useAuth as useDirectAuth } from '@/modules/core/client/react-app/auth';

describe('AppProviders', () => {
  it('shares context hooks with features that still use direct imports', () => {
    expect(useBootstrapData).toBe(useDirectBootstrapData);
    expect(useAuth).toBe(useDirectAuth);
  });

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

  it("uses the router's query client so loaders and pages share one cache", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['loaded-by-route'], 'from the loader');

    function Consumer() {
      return (
        <span>
          {useQueryClient().getQueryData<string>(['loaded-by-route'])}
        </span>
      );
    }

    render(
      <AppProviders
        bootstrapData={{ settings: {}, title: 'Trustroots', user: null }}
        queryClient={queryClient}
      >
        <Consumer />
      </AppProviders>,
    );

    expect(screen.getByText('from the loader')).toBeInTheDocument();
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
