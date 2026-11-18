import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import React from 'react';

/** Render with a fresh QueryClient that, like a failed request, does not retry. */
export function renderWithQueries(
  ui: React.ReactElement,
  { wrapper: Wrapper = React.Fragment, ...options }: RenderOptions = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <Wrapper>{children}</Wrapper>
      </QueryClientProvider>
    ),
  });
}
