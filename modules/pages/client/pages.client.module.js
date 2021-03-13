import AppConfig from '@/modules/core/client/app/config';

import '@/modules/core/client/core.client.module';

AppConfig.registerModule('pages', ['core']);

// config
require('@/modules/pages/client/config/pages.client.routes');
