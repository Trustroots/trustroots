import { act, renderHook } from '@testing-library/react';
import useCircleSigner from '@/modules/tribes/client/hooks/useCircleSigner';
import { connectRadioSigner } from '@/modules/tribes/client/services/radio.client.service';

jest.mock('@/modules/tribes/client/services/radio.client.service');

const user = {
  _id: 'sample',
  username: 'sample',
  displayName: 'Sample',
  nostrNpub: 'linked',
};

afterEach(() => {
  delete window.nostr;
  jest.useRealTimers();
  jest.resetAllMocks();
});

it('ignores connection attempts without a mounted account', async () => {
  const guest = renderHook(() => useCircleSigner());
  await act(async () => guest.result.current.connect());
  const member = renderHook(() => useCircleSigner(user));
  const connect = member.result.current.connect;
  member.unmount();
  await act(async () => connect());
  expect(connectRadioSigner).not.toHaveBeenCalled();
});

it('stops detecting the provider after five seconds', async () => {
  jest.useFakeTimers();
  renderHook(() => useCircleSigner(user));
  await act(async () => jest.advanceTimersByTime(5000));
  window.nostr = {
    getPublicKey: async () => 'key',
    signEvent: async event => event,
  };
  await act(async () => jest.advanceTimersByTime(5000));
  expect(connectRadioSigner).not.toHaveBeenCalled();
});

it('lets a manual request take over provider detection without a duplicate request', async () => {
  jest.useFakeTimers();
  const { result } = renderHook(() => useCircleSigner(user));
  window.nostr = {
    getPublicKey: async () => 'key',
    signEvent: async event => event,
  };
  let complete!: (error: Error) => void;
  jest.mocked(connectRadioSigner).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        complete = reject;
      }),
  );
  act(() => {
    void result.current.connect();
    void result.current.connect();
  });
  await act(async () => jest.advanceTimersByTime(250));
  expect(connectRadioSigner).toHaveBeenCalledTimes(1);
  await act(async () => complete(new Error('Declined')));
});
