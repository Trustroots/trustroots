import AppConfig from '@/modules/core/client/app/config';

import '@/modules/core/client/core.client.module';

AppConfig.registerModule('statistics', ['core']);

// config
require('@/modules/statistics/client/config/statistics.client.routes');

// controllers
require('@/modules/statistics/client/controllers/statistics.client.controller');

// services
require('@/modules/statistics/client/services/statistics.client.service');
