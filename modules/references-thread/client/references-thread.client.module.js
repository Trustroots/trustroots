import AppConfig from '@/modules/core/client/app/config';

import '@/modules/core/client/core.client.module';

AppConfig.registerModule('references-thread', ['core']);

// directives
require('@/modules/references-thread/client/directives/reference-thread.client.directive');

// services
require('@/modules/references-thread/client/services/reference-thread.client.service');
