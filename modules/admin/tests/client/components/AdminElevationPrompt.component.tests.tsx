import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminElevationPrompt from '@/modules/admin/client/components/AdminElevationPrompt.component';
import {
  cancelAdminPassword,
  isAdminElevationPending,
  submitAdminPassword,
} from '@/modules/admin/client/api/admin-elevation';

jest.mock('@/modules/admin/client/api/admin-elevation', () => ({
  cancelAdminPassword: jest.fn(),
  isAdminElevationPending: jest.fn(),
  submitAdminPassword: jest.fn(),
}));

const mockedIsPending = jest.mocked(isAdminElevationPending);
const mockedSubmitPassword = jest.mocked(submitAdminPassword);
const mockedCancelPassword = jest.mocked(cancelAdminPassword);

describe('AdminElevationPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsPending.mockReturnValue(false);
  });

  it('opens when an elevation request arrives and submits the password', () => {
    render(<AdminElevationPrompt />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => window.dispatchEvent(new Event('trustroots:admin-elevation')));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/next half hour/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'ExamplePassword123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(mockedSubmitPassword).toHaveBeenCalledWith('ExamplePassword123!');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('requires a password before continuing', () => {
    render(<AdminElevationPrompt />);
    act(() => window.dispatchEvent(new Event('trustroots:admin-elevation')));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter your current password.',
    );
    expect(mockedSubmitPassword).not.toHaveBeenCalled();
  });

  it('cancels the request and closes the prompt', () => {
    render(<AdminElevationPrompt />);
    act(() => window.dispatchEvent(new Event('trustroots:admin-elevation')));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockedCancelPassword).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens immediately when a password request is already pending', () => {
    mockedIsPending.mockReturnValue(true);

    render(<AdminElevationPrompt />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
