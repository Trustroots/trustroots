import { solveSigninChallenge } from '@/modules/users/client/utils/signin-challenge';

describe('sign-in challenge worker', () => {
  let worker: {
    onmessage?: (event: { data: number }) => void;
    onerror?: () => void;
    terminate: jest.Mock;
    postMessage: jest.Mock;
  };
  const originalWorker = global.Worker;
  const createUrl = URL.createObjectURL;
  const revokeUrl = URL.revokeObjectURL;
  beforeEach(() => {
    jest.useFakeTimers();
    worker = { terminate: jest.fn(), postMessage: jest.fn() };
    global.Worker = jest.fn(() => worker) as unknown as typeof Worker;
    URL.createObjectURL = jest.fn(() => 'blob:challenge');
    URL.revokeObjectURL = jest.fn();
  });
  afterEach(() => {
    global.Worker = originalWorker;
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = revokeUrl;
    jest.useRealTimers();
  });
  it('solves in a worker and cleans up its resources', async () => {
    const pending = solveSigninChallenge({ token: 'token', difficulty: 14 });
    expect(worker.postMessage).toHaveBeenCalledWith('token');
    worker.onmessage?.({ data: 42 });
    await expect(pending).resolves.toEqual({ token: 'token', solution: 42 });
    expect(worker.terminate).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:challenge');
  });
  it('rejects invalid challenges without creating a worker', async () => {
    for (const challenge of [
      undefined,
      { token: 1, difficulty: 14 },
      { token: 'a'.repeat(2049), difficulty: 14 },
      { token: 'a', difficulty: 30 },
    ]) {
      await expect(solveSigninChallenge(challenge as never)).rejects.toThrow(
        'Invalid',
      );
    }
    expect(global.Worker).not.toHaveBeenCalled();
  });
  it('cleans up failed workers', async () => {
    const pending = solveSigninChallenge({ token: 'token', difficulty: 14 });
    worker.onerror?.();
    await expect(pending).rejects.toThrow('failed');
    expect(worker.terminate).toHaveBeenCalled();
  });
  it('terminates workers after the bounded deadline', async () => {
    const pending = solveSigninChallenge({ token: 'token', difficulty: 14 });
    jest.advanceTimersByTime(30000);
    await expect(pending).rejects.toThrow('timed out');
    expect(worker.terminate).toHaveBeenCalled();
  });
  it('cleans up when workers cannot be created', async () => {
    global.Worker = jest.fn(() => {
      throw new Error('unavailable');
    }) as unknown as typeof Worker;
    await expect(
      solveSigninChallenge({ token: 'token', difficulty: 14 }),
    ).rejects.toThrow('unavailable');
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
