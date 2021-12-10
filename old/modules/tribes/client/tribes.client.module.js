import AppConfig from '@/modules/core/client/app/config';

import '@/modules/core/client/core.client.module';

AppConfig.registerModule('tribes', ['core']);

// config
require('@/modules/tribes/client/config/tribes.client.routes');

// controllers
require('@/modules/tribes/client/controllers/tribe.client.controller');
require('@/modules/tribes/client/controllers/tribes-list.client.controller');

// directives
require('@/modules/tribes/client/directives/tr-tribe-badge.client.directive');
require('@/modules/tribes/client/directives/tr-tribe-join-button.client.directive');
require('@/modules/tribes/client/directives/tr-tribe-styles.client.directive');
require('@/modules/tribes/client/directives/tr-tribes-in-common.client.directive');

// services
require('@/modules/tribes/client/services/tribe.client.service');
require('@/modules/tribes/client/services/tribes.client.service');
