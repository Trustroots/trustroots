import { useEffect, useState } from 'react';

function readCurrentPath(includeSearch: boolean): string {
  return `${window.location.pathname}${
    includeSearch ? window.location.search : ''
  }`;
}

export function useCurrentPath({
  includeSearch = false,
}: { includeSearch?: boolean } = {}) {
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
