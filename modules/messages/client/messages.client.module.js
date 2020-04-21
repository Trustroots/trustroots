import AppConfig from '@/modules/core/client/app/config';

import '@/modules/core/client/core.client.module';

AppConfig.registerModule('messages', ['core']);

// config
require('@/modules/messages/client/config/messages.client.routes');

if (process.env.NODE_ENV !== 'test') {
  require('@/modules/messages/client/config/messages.client.run');
}
