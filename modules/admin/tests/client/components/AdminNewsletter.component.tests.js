import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminNewsletter from '@/modules/admin/client/components/AdminNewsletter.component';
import * as newsletterApi from '@/modules/admin/client/api/newsletter.api';

jest.mock('@/modules/admin/client/api/newsletter.api');

describe('<AdminNewsletter />', () => {
  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:newsletter');
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the newsletter split form', () => {
    render(<AdminNewsletter />);

    expect(screen.getByText('Newsletter subscribers')).toBeInTheDocument();
    expect(
      screen.getByText(
        /split it into two downloadable CSV files: still subscribed and unsubscribed/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Split recipients' }),
    ).toBeInTheDocument();
  });

  it('shows an error when submitting without selecting a file', async () => {
    render(<AdminNewsletter />);

    fireEvent.click(screen.getByRole('button', { name: 'Split recipients' }));

    expect(await screen.findByText('Choose a CSV file first.')).toBeVisible();
    expect(newsletterApi.splitNewsletterSubscribers).not.toHaveBeenCalled();
  });

  it('uploads and shows download actions for both CSV outputs', async () => {
    newsletterApi.splitNewsletterSubscribers.mockResolvedValueOnce({
      subscribedCount: 1,
      subscribedCsv:
        'Email Address,First Name,Last Name\nalice@example.com,Alice,Example',
      totalEmailCount: 2,
      unsubscribedCount: 1,
      unsubscribedCsv:
        'Email Address,First Name,Last Name\nbob@example.com,Bob,Example',
    });
    const file = new File(
      ['Email Address\nalice@example.com\nbob@example.com'],
      'newsletter.csv',
      {
        type: 'text/csv',
      },
    );

    render(<AdminNewsletter />);

    fireEvent.change(screen.getByLabelText('Newsletter CSV file'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Split recipients' }));

    await waitFor(() =>
      expect(newsletterApi.splitNewsletterSubscribers).toHaveBeenCalledWith(
        file,
      ),
    );
    expect(
      await screen.findByText(
        'Processed 2 emails: 1 still subscribed and 1 unsubscribed.',
      ),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: 'Download still subscribed CSV' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Download unsubscribed CSV' }),
    );

    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('shows API error text when splitting fails', async () => {
    newsletterApi.splitNewsletterSubscribers.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Unsupported file type.',
        },
      },
    });
    const file = new File(['not-an-email'], 'newsletter.txt', {
      type: 'text/plain',
    });

    render(<AdminNewsletter />);

    fireEvent.change(screen.getByLabelText('Newsletter CSV file'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Split recipients' }));

    expect(await screen.findByText('Unsupported file type.')).toBeVisible();
  });
});
