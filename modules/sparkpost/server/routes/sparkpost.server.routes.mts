import type { Express } from 'express';
import sparkpost from './../controllers/sparkpost-webhooks.server.controller.mts';

export default function (app: Express) {
  app
    .route('/api/sparkpost/webhook')
    .post(sparkpost.basicAuthenticate, sparkpost.receiveBatch);
}
