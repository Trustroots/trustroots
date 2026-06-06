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
    const created = new Date('2020-01-01T00:00:00.000Z');

    get.mockResolvedValueOnce({
      reference: 'yes',
      created,
    });

    render(<ReferenceThread userToId="user-1" />);

    expect(await screen.findByText('Change')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('user-1');
  });

  it('renders an existing negative reference answer and allows changing it', async () => {
    get.mockResolvedValueOnce({
      reference: 'no',
      created: new Date('2020-01-01T00:00:00.000Z'),
    });

    render(<ReferenceThread userToId="user-1" />);

    expect((await screen.findByText('No')).closest('p')).toHaveClass(
      'text-danger',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(screen.getByText(/in the spirit of Trustroots/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
  });

  it('asks the question when no existing reference was found', async () => {
    get.mockResolvedValueOnce(null);

    render(<ReferenceThread userToId="user-1" />);

    expect(
      await screen.findByText(/in the spirit of Trustroots/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
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

  it('submits a negative answer when clicking No', async () => {
    get.mockRejectedValueOnce({
      response: { status: 404, data: { allowCreatingReference: true } },
    });
    send.mockResolvedValueOnce({});

    render(<ReferenceThread userToId="user-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'No' }));

    await waitFor(() => expect(send).toHaveBeenCalledWith('no', 'user-1'));
    expect(await screen.findByText('Change')).toBeInTheDocument();
    expect(screen.getByText('No').closest('p')).toHaveClass('text-danger');
  });

  it('uses the fallback deny state for a 404 without response details', async () => {
    get.mockRejectedValueOnce({
      response: { status: 404 },
    });

    const { container } = render(<ReferenceThread userToId="user-1" />);

    await waitFor(() => expect(get).toHaveBeenCalledWith('user-1'));
    expect(container).toBeEmptyDOMElement();
  });

  it('returns to the question if sending the answer fails', async () => {
    get.mockRejectedValueOnce({
      response: { status: 404, data: { allowCreatingReference: true } },
    });
    send.mockRejectedValueOnce(new Error('network error'));

    render(<ReferenceThread userToId="user-1" />);

    const yesButton = await screen.findByRole('button', { name: 'Yes' });
    fireEvent.click(yesButton);

    await waitFor(() => expect(send).toHaveBeenCalledWith('yes', 'user-1'));
    expect(
      await screen.findByRole('button', { name: 'Yes' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
  });

  it('hides component when loading fails with non-404 errors', async () => {
    get.mockRejectedValueOnce({ response: { status: 500, data: {} } });

    const { container } = render(<ReferenceThread userToId="user-1" />);

    await waitFor(() => expect(get).toHaveBeenCalledWith('user-1'));
    expect(container).toBeEmptyDOMElement();
  });
});
