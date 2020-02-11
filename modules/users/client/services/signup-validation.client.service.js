// SignupValidation service used for communicating with the signup validation REST endpoint
angular.module('users').factory('SignupValidation', SignupValidationFactory);

/* @ngInject */
function SignupValidationFactory($resource) {
  return $resource(
    '/api/auth/signup/validate',
    {},
    {
      post: {
        method: 'POST',
      },
    },
  );
}
