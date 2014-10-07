'use strict';

/**
 * Add hashbang to urls that don't start with '/'
 */
angular.module('core').filter('hashbangurl', [
	function() {
		return function(url) {
		  return (url && url.substr(0,1) !== '/') ? '/#!/' + url : url;
		};
	}
]);
