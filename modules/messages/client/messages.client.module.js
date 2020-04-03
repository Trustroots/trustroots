import AppConfig from '@/modules/core/client/app/config';

import '@/modules/core/client/core.client.module';

AppConfig.registerModule('messages', ['core']);

// config
require('@/modules/messages/client/config/messages.client.routes');

// directives
require('@/modules/messages/client/directives/unread-count.client.directive');

// services
require('@/modules/messages/client/services/messages-count-poll.client.service');
require('@/modules/messages/client/services/messages-count.client.service');
