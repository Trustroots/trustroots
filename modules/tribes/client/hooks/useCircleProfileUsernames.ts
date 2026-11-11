import { useEffect, useState } from 'react';
import { fetchRadioAuthorUsernames } from '../services/radio.client.service';

export default function useCircleProfileUsernames(pubkeys: string[]) {
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const keys = [...new Set(pubkeys)].sort().join(',');

  useEffect(() => {
    if (!keys) return;
    const controller = new AbortController();
    void fetchRadioAuthorUsernames(keys.split(','), controller.signal)
      .then(profiles => {
        if (!controller.signal.aborted) setUsernames(profiles);
      })
      .catch(() => {
        if (!controller.signal.aborted) setUsernames({});
      });
    return () => controller.abort();
  }, [keys]);

  return usernames;
}
