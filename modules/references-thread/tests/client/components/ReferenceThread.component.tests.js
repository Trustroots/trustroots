import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ReferenceThread from '@/modules/references-thread/client/components/ReferenceThread';
import {
  get,
  send,
} from '@/modules/references-thread/client/api/reference-thread.api';

jest.mock('@/modules/references-thread/client/api/reference-thread.api');

afterEach(() => {
  jest.clearAllMocks();
});

describe('<ReferenceThread />', () => {
  it('renders an existing reference answer', async () => {
    get.mockResolvedValueOnce({
      reference: 'yes',
      created: '2020-01-01T00:00:00.000Z',
    });

    render(<ReferenceThread userToId="user-1" />);

    expect(await screen.findByText('Change')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('user-1');
  });

  it('asks the question when allowed to create a reference', async () => {
    get.mockRejectedValueOnce({
      response: { status: 404, data: { allowCreatingReference: true } },
    });

    render(<ReferenceThread userToId="user-1" />);

    expect(
      await screen.findByText(/in the spirit of Trustroots/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
  });

  it('renders nothing when creating a reference is not allowed', async () => {
    get.mockRejectedValueOnce({
      response: { status: 404, data: { allowCreatingReference: false } },
    });

    const { container } = render(<ReferenceThread userToId="user-1" />);

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('submits an answer when clicking Yes', async () => {
    get.mockRejectedValueOnce({
      response: { status: 404, data: { allowCreatingReference: true } },
    });
    send.mockResolvedValueOnce({});

    render(<ReferenceThread userToId="user-1" />);

    const yesButton = await screen.findByRole('button', { name: 'Yes' });
    fireEvent.click(yesButton);

    await waitFor(() => expect(send).toHaveBeenCalledWith('yes', 'user-1'));
    expect(await screen.findByText('Change')).toBeInTheDocument();
  });
});
