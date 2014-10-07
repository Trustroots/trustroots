'use strict';

// Users service used for communicating with the users REST endpoint
angular.module('core').factory('Languages', ['$http',
    function($http) {
        var $service = {}

        $service.get = function () {
            $http.get('/modules/core/languages/languages.json').success(function(data){
                return $service.languages = data;
            })
        }

        return $service;
    }
]);