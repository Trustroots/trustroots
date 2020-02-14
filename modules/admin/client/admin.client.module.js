import AppConfig from '@/modules/core/client/app/config';

import '@/modules/core/client/core.client.module';

AppConfig.registerModule('admin', ['core']);

// config
require('@/modules/admin/client/config/admin.client.routes');
