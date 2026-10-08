interface Challenge {
  token: string;
  difficulty: number;
}

// Keep hashing off the UI thread and bound computation and worker lifetime.
export function solveSigninChallenge(
  challenge: Challenge,
): Promise<{ token: string; solution: number }> {
  if (
    typeof challenge?.token !== 'string' ||
    challenge.token.length > 2048 ||
    challenge.difficulty !== 14
  ) {
    return Promise.reject(new Error('Invalid sign-in challenge.'));
  }
  return new Promise((resolve, reject) => {
    const source = `onmessage = async ({ data }) => {
      const encoder = new TextEncoder();
      for (let solution = 0; solution <= 4194304; solution++) {
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(data + ':' + solution)));
        if (hash[0] === 0 && (hash[1] & 252) === 0) { postMessage(solution); return; }
      }
      throw new Error('Challenge exhausted.');
    };`;
    const url = URL.createObjectURL(
      new Blob([source], { type: 'text/javascript' }),
    );
    let worker: Worker;
    const cleanup = () => {
      // The callback runs after timer initialisation.
      // eslint-disable-next-line no-use-before-define
      clearTimeout(timer);
      worker?.terminate();
      URL.revokeObjectURL(url);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Sign-in check timed out. Please try again.'));
    }, 30000);
    try {
      worker = new Worker(url);
      worker.onmessage = ({ data }) => {
        cleanup();
        resolve({ token: challenge.token, solution: data });
      };
      worker.onerror = () => {
        cleanup();
        reject(new Error('Sign-in check failed. Please try again.'));
      };
      worker.postMessage(challenge.token);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
