// Feature page imports live in the shell, so this re-export does not make
// core depend on those modules.
export {
  createAppRouter,
  findRoute,
  isReactRoute,
  normalizePath,
  parseLegacySearch,
  rootRoute,
  routeTree,
  routes,
  stringifyLegacySearch,
} from '@/layers/shell/client/routes';
export type { RoutePolicy } from '@/layers/shell/client/routes';
