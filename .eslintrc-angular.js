module.exports = {
  plugins: [
    'angular'
  ],
  rules: {
    'angular/component-limit': 0,
    'angular/controller-as-route': 1,
    'angular/controller-as-vm': 1,
    'angular/controller-as': 1,
    'angular/deferred': 1,
    'angular/di-unused': 2,
    'angular/directive-restrict': 0,
    'angular/empty-controller': 2,
    'angular/no-controller': 0,
    'angular/no-inline-template': 0,
    'angular/no-run-logic': 0,
    'angular/no-services': 0,
    'angular/on-watch': 0,
    'angular/prefer-component': 0,
    'angular/no-cookiestore': 2,
    'angular/no-directive-replace': 0,
    'angular/no-http-callback': 1,
    'angular/angularelement': 2,
    'angular/definedundefined': 2,
    'angular/document-service': 2,
    'angular/interval-service': 2,
    'angular/json-functions': 2,
    'angular/log': 1,
    'angular/timeout-service': 2,
    'angular/typecheck-array': 2,
    'angular/typecheck-date': 2,
    'angular/typecheck-function': 2,
    'angular/typecheck-number': 2,
    'angular/typecheck-object': 2,
    'angular/typecheck-string': 2,
    'angular/window-service': 2
  },
  env: {
    browser: true,
    jquery: true
  },
  settings: {
    angular: 1
  }
};
