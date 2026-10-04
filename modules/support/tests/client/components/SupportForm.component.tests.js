import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import SupportForm from '@/modules/support/client/components/SupportForm';
import { send } from '@/modules/support/client/api/support.api';

jest.mock('@/modules/support/client/api/support.api');

const scrollIntoView = jest.fn();
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
});
afterAll(() => {
  delete HTMLElement.prototype.scrollIntoView;
});

afterEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('<SupportForm />', () => {
  it('opens and submits the bug-report category without a reported member', async () => {
    send.mockResolvedValueOnce({});
    window.history.pushState({}, '', '/support?category=reportBug');
    render(<SupportForm user={{}} />);
    expect(screen.getByRole('option', { name: 'Report a bug' })).toHaveValue(
      'reportBug',
    );
    expect(screen.getByLabelText('What can we help with?')).toHaveValue(
      'reportBug',
    );
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'A fictional button does not respond.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'reportBug',
          reportMember: '',
        }),
      ),
    );
  });
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
      category: 'other',
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
    expect(screen.getByRole('alert')).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    expect(screen.getByLabelText('Message')).toHaveValue('I need help');
  });

  it('refocuses a repeated failure and allows a successful retry', async () => {
    send
      .mockRejectedValueOnce(new Error('delivery unavailable'))
      .mockRejectedValueOnce(new Error('delivery unavailable'))
      .mockResolvedValueOnce({});
    render(<SupportForm user={{}} />);
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'A saved support enquiry.' },
    });

    for (let attempt = 1; attempt <= 2; attempt++) {
      screen.getByRole('button', { name: 'Send' }).focus();
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveFocus());
      expect(scrollIntoView).toHaveBeenCalledTimes(attempt);
      expect(screen.getByLabelText('Message')).toHaveValue(
        'A saved support enquiry.',
      );
    }
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(
      await screen.findByRole('link', { name: 'home' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
    window.history.pushState(
      {},
      '',
      '/support?report=bob&category=volunteering',
    );

    render(<SupportForm user={{}} />);

    expect(screen.getByText('Reported member')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByLabelText('What can we help with?')).toHaveValue(
      'reportMember',
    );
    expect(
      screen.getByText(
        'This message goes to Trustroots support, not to the member.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Report member to support' }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'I need to report Bob' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'I need to report Bob',
          reportMember: 'bob',
          category: 'reportMember',
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

  it('opens a short volunteer enquiry and submits its category', async () => {
    send.mockResolvedValueOnce({});
    window.history.pushState({}, '', '/support?category=volunteering');
    render(<SupportForm user={{}} />);
    expect(screen.getByLabelText('What can we help with?')).toHaveValue(
      'volunteering',
    );
    expect(
      screen.getByText(
        /Briefly tell us about your interests, skills, and availability\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Guide' })).toHaveAttribute(
      'href',
      'https://team.trustroots.org/',
    );
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'I can help translate for two hours a week.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'volunteering',
          reportMember: '',
        }),
      ),
    );
  });

  it.each(['unknown', 'toString', ''])(
    'ignores unsupported URL category %s',
    category => {
      window.history.pushState({}, '', `/support?category=${category}`);
      render(<SupportForm user={{}} />);
      expect(screen.getByLabelText('What can we help with?')).toHaveValue(
        'other',
      );
    },
  );

  it('omits the reported member when changing category and restores it when switching back', async () => {
    send.mockResolvedValueOnce({});
    window.history.pushState({}, '', '/support?report=example-member');
    render(<SupportForm user={{}} />);
    const category = screen.getByLabelText('What can we help with?');
    fireEvent.change(category, { target: { value: 'account' } });
    expect(
      screen.queryByRole('link', { name: 'Team Guide' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('example-member')).not.toBeInTheDocument();
    fireEvent.change(category, { target: { value: 'reportMember' } });
    expect(
      screen.queryByRole('link', { name: 'Team Guide' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('example-member')).toBeInTheDocument();
    fireEvent.change(category, { target: { value: 'volunteering' } });
    expect(screen.getByRole('link', { name: 'Team Guide' })).toHaveAttribute(
      'href',
      'https://team.trustroots.org/',
    );
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'I can help.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'volunteering',
          reportMember: '',
        }),
      ),
    );
  });

  it('shows reporting guidance when selected without a report URL', () => {
    render(<SupportForm user={{}} />);
    fireEvent.change(screen.getByLabelText('What can we help with?'), {
      target: { value: 'reportMember' },
    });
    expect(
      screen.getByText('Please include the member’s username in your message.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'This message goes to Trustroots support, not to the member.',
      ),
    ).toBeInTheDocument();
  });

  it('disables category selection while sending', async () => {
    let finishSending;
    send.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishSending = resolve;
        }),
    );
    render(<SupportForm user={{}} />);
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Please help.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByLabelText('What can we help with?')).toBeDisabled();
    finishSending({});
    expect(
      await screen.findByText(/Thanks for getting in touch!/),
    ).toBeInTheDocument();
  });

  it('leaves the default category when URL parsing fails without a query string', () => {
    const OriginalURL = global.URL;
    global.URL = jest.fn(() => {
      throw new Error('broken URL parser');
    });
    try {
      render(<SupportForm user={{}} />);
      expect(screen.getByLabelText('What can we help with?')).toHaveValue(
        'other',
      );
    } finally {
      global.URL = OriginalURL;
    }
  });
});
