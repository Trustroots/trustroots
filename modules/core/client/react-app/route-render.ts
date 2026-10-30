import React from 'react';

import type { AuthUser } from './auth';

export type RouteContext = {
  user: AuthUser | null;
  currentPath: string;
  params: Record<string, string>;
  navigate?: (path: string) => void;
};
export type RouteRender = (context: RouteContext) => React.ReactNode;

export function renderWithUser(Component: React.ElementType) {
  return function renderRoute({ user }: RouteContext) {
    return React.createElement(Component, { user });
  };
}
