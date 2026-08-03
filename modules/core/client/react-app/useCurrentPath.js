import { useEffect, useState } from 'react';

function readCurrentPath(includeSearch) {
  return `${window.location.pathname}${
    includeSearch ? window.location.search : ''
  }`;
}

export function useCurrentPath({ includeSearch = false } = {}) {
  const [currentPath, setCurrentPath] = useState(() =>
    readCurrentPath(includeSearch),
  );

  useEffect(() => {
    const onPopState = () => setCurrentPath(readCurrentPath(includeSearch));

    window.addEventListener('popstate', onPopState);

    return () => window.removeEventListener('popstate', onPopState);
  }, [includeSearch]);

  return currentPath;
}
