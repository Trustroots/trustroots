import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import {
  AppProviders,
  useBootstrapData,
} from '@/modules/core/client/react-app/AppProviders';

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
      <AppProviders bootstrapData={{ title: 'Bootstrap title' }}>
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
      React.createElement(
        AppProviders,
        null,
        React.createElement(TestConsumer),
      ),
    );

    expect(screen.getByText('Window title')).toBeInTheDocument();
    delete window.title;
  });
});
