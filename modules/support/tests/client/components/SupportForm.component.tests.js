import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import SupportForm from '@/modules/support/client/components/SupportForm';
import { send } from '@/modules/support/client/api/support.api';

jest.mock('@/modules/support/client/api/support.api');

afterEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
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

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(
      await screen.findByRole('link', { name: 'frequently asked questions' }),
    ).toBeInTheDocument();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'I need help' }),
    );
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
  });
});
