import {
  findRoute,
  isReactRoute,
  routes,
} from '@/modules/core/client/react-app/routes';
import {
  REACT_OWNED_PATHS,
  normalizePath,
} from '@/modules/core/shared/react-route-ownership';

describe('React route ownership', () => {
  it('keeps the React route table aligned with the shared ownership list', () => {
    expect(routes.map(route => route.path).sort()).toEqual(
      [...REACT_OWNED_PATHS].sort(),
    );
  });

  it('normalizes paths before ownership checks', () => {
    expect(normalizePath('/support/?report=alice')).toBe('/support');
    expect(isReactRoute('/support/?report=alice')).toBe(true);
    expect(findRoute('/support/?report=alice').title).toBe('Support');
  });

  it('does not claim Angular-owned paths', () => {
    expect(isReactRoute('/profile/alice')).toBe(false);
    expect(findRoute('/profile/alice')).toBe(undefined);
  });
});
