import AppConfig from '@/modules/core/client/app/config';

import '@/modules/core/client/core.client.module';

AppConfig.registerModule('support', ['core']);

// config
require('@/modules/support/client/config/support.client.routes');
