import AppConfig from '@/modules/core/client/app/config';

import '@/modules/core/client/core.client.module';

AppConfig.registerModule('pages', ['core']);

// config
require('@/modules/pages/client/config/pages.client.routes');

// controllers
require('@/modules/pages/client/controllers/faq.client.controller');
require('@/modules/pages/client/controllers/home.client.controller');

// services
require('@/modules/pages/client/services/home.client.service.js');
