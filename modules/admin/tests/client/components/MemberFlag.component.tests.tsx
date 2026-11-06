import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MemberFlag from '../../../client/components/MemberFlag.component';
import * as api from '../../../client/api/support.api';
jest.mock('../../../client/api/support.api');
const setFlag = jest.mocked(api.setMemberFlag);
afterEach(() => jest.resetAllMocks());
it('waits for persistence and preserves all other roles when removing a flag', async () => {
  let resolve!: () => void;
  setFlag.mockReturnValue(
    new Promise<void>(yes => {
      resolve = yes;
    }),
  );
  const changed = jest.fn();
  render(
    <MemberFlag
      member={{ _id: 'member-1', roles: ['user', 'flagged', 'support-team'] }}
      onChanged={changed}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove flag' }));
  expect(screen.getByRole('button')).toBeDisabled();
  expect(changed).not.toHaveBeenCalled();
  await act(async () => resolve());
  expect(setFlag).toHaveBeenCalledWith('member-1', false);
  expect(changed).toHaveBeenCalledWith(['user', 'support-team']);
});
it('adds a follow-up flag', async () => {
  setFlag.mockResolvedValue(undefined);
  const changed = jest.fn();
  render(
    <MemberFlag
      member={{ _id: 'member-1', roles: ['user'] }}
      onChanged={changed}
    />,
  );
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Flag for follow-up' })),
  );
  expect(changed).toHaveBeenCalledWith(['user', 'flagged']);
});
it('keeps the prior state on failure and permits retry', async () => {
  setFlag
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(undefined);
  const changed = jest.fn();
  render(
    <MemberFlag
      member={{ _id: 'member-1', roles: ['user'] }}
      onChanged={changed}
    />,
  );
  fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not update the flag.',
  );
  expect(changed).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole('button')));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(changed).toHaveBeenCalled();
});
