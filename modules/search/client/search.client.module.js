import AppConfig from '@/modules/core/client/app/config';

import '@/modules/core/client/core.client.module';

AppConfig.registerModule('search', ['core']);

// Templates used in `ng-include`s
require('@/modules/search/client/views/search-sidebar-results.client.view.html');
require('@/modules/search/client/views/search-sidebar-filters.client.view.html');
require('@/modules/search/client/views/search-input.client.view.html');

// config
require('@/modules/search/client/config/search.client.routes');

// controllers
require('@/modules/search/client/controllers/search-map.client.controller');
require('@/modules/search/client/controllers/search.client.controller');

// directives
require('@/modules/search/client/directives/tr-my-tribes-toggle.client.directive');
require('@/modules/search/client/directives/tr-tribes-toggle.client.directive');
require('@/modules/search/client/directives/tr-types-toggle.client.directive');

// services
require('@/modules/search/client/services/filters.client.service');
