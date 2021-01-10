import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/core.client.module';

AppConfig.registerModule('statistics', ['core']);

// config
require('@/modules/statistics/client/config/statistics.client.routes');
