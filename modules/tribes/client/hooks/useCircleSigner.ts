import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserProfile } from '@/modules/users/client/types';
import {
  connectRadioSigner,
  type RadioSigner,
} from '../services/radio.client.service';

export default function useCircleSigner(user?: UserProfile) {
  const username = user?.username;
  const nostrNpub = user?.nostrNpub;
  const attempt = useRef<{ pending: boolean; triedProvider: boolean } | null>(
    null,
  );
  const [signer, setSigner] = useState<RadioSigner>();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const connect = useCallback(async () => {
    const current = attempt.current;
    if (!username || !current || current.pending) return;

    current.pending = true;
    current.triedProvider ||= hasNostrProvider();
    setConnecting(true);
    setError('');
    try {
      const identity = await connectRadioSigner({ username, nostrNpub });
      if (attempt.current === current) setSigner(identity);
    } catch (cause) {
      if (attempt.current === current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not connect your Nostr identity.',
        );
      }
    } finally {
      current.pending = false;
      if (attempt.current === current) setConnecting(false);
    }
  }, [username, nostrNpub]);

  useEffect(() => {
    if (!username) return;
    const current = { pending: false, triedProvider: false };
    attempt.current = current;
    let timer: number | undefined;
    const deadline = Date.now() + 5000;

    function detect() {
      if (current.triedProvider) return;
      if (hasNostrProvider()) {
        void connect();
      } else if (Date.now() < deadline) {
        timer = window.setTimeout(detect, 250);
      }
    }

    if (nostrNpub) detect();
    return () => {
      attempt.current = null;
      window.clearTimeout(timer);
    };
  }, [connect, nostrNpub, username]);

  return { signer, connecting, error, connect };
}

function hasNostrProvider() {
  const provider = window.nostr;
  return (
    typeof provider?.getPublicKey === 'function' &&
    typeof provider.signEvent === 'function'
  );
}
