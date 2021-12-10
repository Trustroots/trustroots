import angular from 'angular';

function get(name) {
  return angular.element(document).injector().get(name);
}

export function $broadcast(...args) {
  return get('$rootScope').$broadcast(...args);
}

export function $on(...args) {
  return get('$rootScope').$on(...args);
}

export function eventTrack(...args) {
  return get('$analytics').eventTrack(...args);
}

export function getRouteParams() {
  return get('$stateParams');
}

export function go(...args) {
  return get('$state').go(...args);
}

export function getUser() {
  return get('Authentication').user;
}
