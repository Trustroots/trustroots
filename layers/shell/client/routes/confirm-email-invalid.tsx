import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import ConfirmEmailInvalidPage from '@/modules/users/client/components/ConfirmEmailInvalidPage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/confirm-email-invalid')(
  routeOptions('/confirm-email-invalid', () => <ConfirmEmailInvalidPage />),
);
