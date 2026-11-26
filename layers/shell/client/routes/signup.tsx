import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import SignupPage from '@/modules/users/client/components/SignupPage.component';
import { memberCircles } from '@/modules/tribes/client/member-circles';

export const Route = createFileRoute('/signup')({
  staticData: {
    title: 'Sign up',
    headerHidden: true,
    footerVariant: 'account',
  },
  component: () => <SignupPage circles={memberCircles} />,
});
