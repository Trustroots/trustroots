import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import UnsuspendMember from '../../../client/components/UnsuspendMember.component';
import * as api from '../../../client/api/users.api';
jest.mock('../../../client/api/users.api');
const unsuspend = jest.mocked(api.unsuspendMember);
const member = { _id: 'member-1', username: 'fictional-member' };
afterEach(() => jest.resetAllMocks());
function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Unsuspend' }));
  return screen.getByRole('dialog');
}
function confirmButton() {
  return within(screen.getByRole('dialog')).getByRole('button', {
    name: 'Confirm unsuspension',
  });
}

it('requires a reason and confirms before restoring access and refreshing', async () => {
  unsuspend.mockResolvedValue({
    changed: true,
    message: 'Member unsuspended.',
  });
  const refresh = jest.fn().mockResolvedValue(undefined);
  render(<UnsuspendMember member={member} onRefresh={refresh} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const dialog = openDialog();
  expect(dialog).toHaveAccessibleName('Unsuspend fictional-member?');
  expect(confirmButton()).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Administrator reason'), {
    target: { value: '   ' },
  });
  expect(confirmButton()).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Administrator reason'), {
    target: { value: 'x'.repeat(1001) },
  });
  expect(confirmButton()).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Administrator reason'), {
    target: { value: 'x'.repeat(1000) },
  });
  expect(confirmButton()).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Administrator reason'), {
    target: { value: '  Reviewed a fictional suspension.  ' },
  });
  fireEvent.click(confirmButton());
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(unsuspend).toHaveBeenCalledWith(
    'member-1',
    'Reviewed a fictional suspension.',
  );
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('keeps controls disabled until the action completes', async () => {
  let resolve!: (value: { changed: boolean; message: string }) => void;
  unsuspend.mockReturnValue(
    new Promise(yes => {
      resolve = yes;
    }),
  );
  const refresh = jest.fn().mockResolvedValue(undefined);
  render(<UnsuspendMember member={member} onRefresh={refresh} />);
  openDialog();
  fireEvent.change(screen.getByLabelText('Administrator reason'), {
    target: { value: 'Review complete.' },
  });
  fireEvent.click(confirmButton());
  expect(screen.getByRole('status')).toHaveTextContent(
    'Updating member report',
  );
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(screen.getByLabelText('Administrator reason')).toBeDisabled();
  await act(async () => resolve({ changed: true, message: 'Done' }));
  expect(refresh).toHaveBeenCalled();
});
it('shows an operation error and resets the reason when reopened', async () => {
  unsuspend.mockRejectedValue(new Error('failed'));
  const refresh = jest.fn();
  render(<UnsuspendMember member={member} onRefresh={refresh} />);
  openDialog();
  fireEvent.change(screen.getByLabelText('Administrator reason'), {
    target: { value: 'Review complete.' },
  });
  fireEvent.click(confirmButton());
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not confirm unsuspension.',
  );
  expect(refresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  openDialog();
  expect(screen.getByLabelText('Administrator reason')).toHaveValue('');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('retries only refreshing after a successful unsuspension', async () => {
  unsuspend.mockResolvedValue({ changed: true, message: 'Done' });
  const refresh = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(undefined);
  render(<UnsuspendMember member={member} onRefresh={refresh} />);
  openDialog();
  fireEvent.change(screen.getByLabelText('Administrator reason'), {
    target: { value: 'Review complete.' },
  });
  fireEvent.click(confirmButton());
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The suspension was removed',
  );
  expect(screen.getByLabelText('Administrator reason')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh report' }));
  await act(async () => {});
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(unsuspend).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('uses the member ID when there is no username and supports dismissal', async () => {
  render(
    <UnsuspendMember member={{ _id: 'member-1' }} onRefresh={jest.fn()} />,
  );
  expect(openDialog()).toHaveAccessibleName('Unsuspend member-1?');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});
