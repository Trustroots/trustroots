import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import SupportForm from '@/modules/support/client/components/SupportForm';
import { send } from '@/modules/support/client/api/support.api';

jest.mock('@/modules/support/client/api/support.api');

afterEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('<SupportForm />', () => {
  it('renders message field and shows the logged-in user details', () => {
    render(
      <SupportForm
        user={{ displayName: 'Alice', username: 'alice', email: 'a@b.c' }}
      />,
    );

    expect(screen.getByText('Contact us')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('a@b.c')).toBeInTheDocument();
  });

  it('sends a support message and shows a confirmation', async () => {
    send.mockResolvedValueOnce({});

    render(<SupportForm user={{}} />);

    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'I need help' },
    });
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'alice' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'alice@example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(
      await screen.findByRole('link', { name: 'frequently asked questions' }),
    ).toBeInTheDocument();
    expect(send).toHaveBeenCalledWith({
      email: 'alice@example.com',
      message: 'I need help',
      reportMember: '',
      username: 'alice',
    });
    expect(window.localStorage.getItem('support-message')).toBe('""');
  });

  it('shows an error message when sending fails', async () => {
    send.mockRejectedValueOnce(new Error('boom'));

    render(<SupportForm user={{}} />);

    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'I need help' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(
      await screen.findByText('Something went wrong sending your message.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('keeps the send button disabled until message has non-whitespace text', () => {
    render(<SupportForm user={{}} />);

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: '   ' },
    });
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Real support request' },
    });
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('loads a persisted draft message', () => {
    window.localStorage.setItem('support-message', '"Saved support draft"');

    render(<SupportForm user={{}} />);

    expect(screen.getByLabelText('Message')).toHaveValue('Saved support draft');
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('includes the reported member from the URL', async () => {
    send.mockResolvedValueOnce({});
    window.history.pushState({}, '', '/support?report=bob');

    render(<SupportForm user={{}} />);

    expect(screen.getByText('Reporting member')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'I need to report Bob' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'I need to report Bob',
          reportMember: 'bob',
        }),
      ),
    );
  });

  it('falls back to the raw query string when report URL parsing fails', async () => {
    const OriginalURL = global.URL;
    global.URL = jest.fn(() => {
      throw new Error('broken URL parser');
    });

    try {
      window.history.pushState({}, '', '/support?report=bob');

      render(<SupportForm user={{}} />);

      expect(await screen.findByText('?report=bob')).toBeInTheDocument();
    } finally {
      global.URL = OriginalURL;
    }
  });
});
