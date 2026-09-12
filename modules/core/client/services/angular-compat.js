/* eslint-disable angular/window-service */

function get(name) {
  if (!window.angular) {
    return null;
  }

  const injector = window.angular.element(document).injector();

  if (!injector) {
    return null;
  }

  return injector.get(name);
}

function dispatchFallback(eventName, args) {
  window.dispatchEvent(
    new CustomEvent(`tr:${eventName}`, {
      detail: args,
    }),
  );
}

export function $broadcast(...args) {
  const rootScope = get('$rootScope');

  if (!rootScope) {
    dispatchFallback(args[0], args.slice(1));
    return undefined;
  }

  return rootScope.$broadcast(...args);
}

export function $on(eventName, listener) {
  const rootScope = get('$rootScope');

  if (!rootScope) {
    const fallbackListener = event => listener(null, ...(event.detail || []));
    window.addEventListener(`tr:${eventName}`, fallbackListener);
    return () =>
      window.removeEventListener(`tr:${eventName}`, fallbackListener);
  }

  return rootScope.$on(eventName, listener);
}

export function eventTrack(...args) {
  const analytics = get('$analytics');

  if (!analytics) {
    return undefined;
  }

  return analytics.eventTrack(...args);
}

export function getRouteParams() {
  return get('$stateParams') || {};
}

export function go(...args) {
  const state = get('$state');

  if (!state) {
    return undefined;
  }

  return state.go(...args);
}

export function getUser() {
  const authentication = get('Authentication');

  return authentication?.user || window.user || null;
}
