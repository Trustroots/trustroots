import angular from 'angular';

function get(name) {
  return angular.element(document).injector().get(name);
}

export function $broadcast(...args) {
  return get('$rootScope').$broadcast(...args);
}
