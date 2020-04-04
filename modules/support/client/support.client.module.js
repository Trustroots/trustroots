import AppConfig from '@/modules/core/client/app/config';

import '@/modules/core/client/core.client.module';

AppConfig.registerModule('support', ['core']);

// config
require('@/modules/support/client/config/support.client.routes');

// controllers
require('@/modules/support/client/controllers/support.client.controller');

// services
require('@/modules/support/client/services/support.client.service');
