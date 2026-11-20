import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '@/config/client/i18n';
import PendingAuthoredExperiences from '@/modules/experiences/client/components/PendingAuthoredExperiences';
import { read } from '@/modules/experiences/client/api/experiences.api';
import type { Experience } from '@/modules/experiences/shared/experience';

vi.mock('@/modules/experiences/client/api/experiences.api');

const base: Experience = {
  _id: 'newer',
  created: '2026-01-02T12:00:00.000Z',
  public: false,
  userFrom: { _id: 'author', username: 'author' },
  userTo: { _id: 'recipient', username: 'recipient' },
  response: null,
};

function renderPending() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <PendingAuthoredExperiences userId="author" />
    </QueryClientProvider>,
  );
}

describe('<PendingAuthoredExperiences />', () => {
  it('omits the section when there are no pending authored records', async () => {
    vi.mocked(read).mockResolvedValueOnce([]);
    renderPending();
    await waitFor(() =>
      expect(read).toHaveBeenCalledWith({
        userTo: 'author',
        view: 'pending-authored',
      }),
    );
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('retries a failed load and shows earlier pending cards first', async () => {
    vi.mocked(read)
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce([
        base,
        {
          ...base,
          _id: 'older',
          userTo: { _id: 'earlier-recipient', username: 'earlier-recipient' },
        },
      ]);
    renderPending();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    const section = await screen.findByRole('region', {
      name: 'Experiences you shared that are still private',
    });
    expect(section).toHaveTextContent(/earlier-recipient.*recipient/);
    expect(
      screen.getAllByText(/Your experience will become public/),
    ).toHaveLength(2);
  });
});
