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
      screen.getByRole('button', { name: 'Export all subscribers CSV' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Export circle subscribers CSV' }),
    ).toBeInTheDocument();
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

  it('exports all subscribers CSV', async () => {
    newsletterApi.getNewsletterSubscribersCsv.mockResolvedValueOnce(
      'Email Address,First Name,Last Name\nalice@example.com,Alice,Example',
    );
    render(<AdminNewsletter />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Export all subscribers CSV' }),
    );

    await waitFor(() =>
      expect(newsletterApi.getNewsletterSubscribersCsv).toHaveBeenCalledTimes(
        1,
      ),
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('validates circle export input', async () => {
    render(<AdminNewsletter />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Export circle subscribers CSV' }),
    );

    expect(await screen.findByText('Enter a circle ID first.')).toBeVisible();
    expect(
      newsletterApi.getNewsletterCircleSubscribersCsv,
    ).not.toHaveBeenCalled();
  });

  it('exports circle subscribers CSV', async () => {
    newsletterApi.getNewsletterCircleSubscribersCsv.mockResolvedValueOnce(
      'Email Address,First Name,Last Name\nalice@example.com,Alice,Example',
    );
    render(<AdminNewsletter />);

    fireEvent.change(screen.getByLabelText('Circle ID'), {
      target: { value: '5fbab4f7fed63c7ed73276d3' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Export circle subscribers CSV' }),
    );

    await waitFor(() =>
      expect(
        newsletterApi.getNewsletterCircleSubscribersCsv,
      ).toHaveBeenCalledWith('5fbab4f7fed63c7ed73276d3'),
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
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

  it('shows fallback error text when splitting fails without API message', async () => {
    newsletterApi.splitNewsletterSubscribers.mockRejectedValueOnce(
      new Error('Network issue'),
    );
    const file = new File(
      ['Email Address\nalice@example.com'],
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

    expect(
      await screen.findByText(
        'Could not split newsletter subscribers from this CSV file.',
      ),
    ).toBeVisible();
  });

  it('clears selected file when file input becomes empty', async () => {
    const file = new File(
      ['Email Address\nalice@example.com'],
      'newsletter.csv',
      {
        type: 'text/csv',
      },
    );
    render(<AdminNewsletter />);

    fireEvent.change(screen.getByLabelText('Newsletter CSV file'), {
      target: { files: [file] },
    });
    fireEvent.change(screen.getByLabelText('Newsletter CSV file'), {
      target: { files: null },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Split recipients' }));

    expect(await screen.findByText('Choose a CSV file first.')).toBeVisible();
    expect(newsletterApi.splitNewsletterSubscribers).not.toHaveBeenCalled();
  });

  it('shows API error text when export fails', async () => {
    newsletterApi.getNewsletterSubscribersCsv.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Export failed.',
        },
      },
    });
    render(<AdminNewsletter />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Export all subscribers CSV' }),
    );

    expect(await screen.findByText('Export failed.')).toBeVisible();
  });

  it('shows fallback error text when export all fails without API message', async () => {
    newsletterApi.getNewsletterSubscribersCsv.mockRejectedValueOnce(
      new Error('Network issue'),
    );
    render(<AdminNewsletter />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Export all subscribers CSV' }),
    );

    expect(
      await screen.findByText('Could not export newsletter subscribers.'),
    ).toBeVisible();
  });

  it('shows fallback error text when circle export fails without API message', async () => {
    newsletterApi.getNewsletterCircleSubscribersCsv.mockRejectedValueOnce(
      new Error('Network issue'),
    );
    render(<AdminNewsletter />);

    fireEvent.change(screen.getByLabelText('Circle ID'), {
      target: { value: '5fbab4f7fed63c7ed73276d3' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Export circle subscribers CSV' }),
    );

    expect(
      await screen.findByText(
        'Could not export newsletter subscribers for this circle.',
      ),
    ).toBeVisible();
  });
});
