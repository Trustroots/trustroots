'use strict';

// Users service used for communicating with the users REST endpoint
angular.module('users').factory('Users', ['$resource',
    function($resource) {
        return $resource('users', {}, {
            update: {
                method: 'PUT'
            },
            get: {
                method: 'GET'
            }
        });
    }
]);

angular.module('users').factory('UserProfiles', ['$resource',
    function($resource) {
        return $resource('users/:username', {username:'@username'}, {
            get: {
                method: 'GET'
            }
        });
    }
]);

angular.module('users').factory('UsersMini', ['$resource',
    function($resource) {
        return $resource('users/mini/:userId', {userId:'@id'}, {
            get: {
                method: 'GET'
            }
        });
    }
]);