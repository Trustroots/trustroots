'use strict';

// Configuring the Search module
angular.module('search').run(['Menus',
  function(Menus) {
    // Set top bar menu items
    Menus.addMenuItem('topbar', 'Search', 'search', 'search', '/search', null, null, 0, 'search fa-lg');
  }
]);
