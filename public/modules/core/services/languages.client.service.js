'use strict';

// Users service used for communicating with the users REST endpoint
angular.module('core').factory('Languages', ['$http', '$q',
    function($http, $q) {
        var service = {}
        var deffered = $q.defer()

        service.get = function () {
            $http.get('/modules/core/languages/languages.json').success(function(data){
                deffered.resolve(data);
            })

            return deffered.promise;
        }

        return service;
    }
]);