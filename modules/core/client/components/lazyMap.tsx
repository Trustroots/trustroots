import React, { type ComponentType, Suspense, lazy } from 'react';

import LoadingIndicator from './LoadingIndicator';

/** Loads a map component, and its map libraries, only when it renders. */
export default function lazyMap<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>,
) {
  const Component = lazy(load);
  return function LazyMap(props: Props) {
    return (
      <Suspense fallback={<LoadingIndicator />}>
        <Component {...props} />
      </Suspense>
    );
  };
}
