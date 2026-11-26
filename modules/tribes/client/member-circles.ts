import type { SignupCircles } from '@/modules/users/client/member-circles';
import { get, join, read } from './api/tribes.api';
import JoinButton from './components/JoinButton';
import { getCircleBackgroundStyle } from './utils';

export const memberCircles = {
  get,
  join,
  read,
  JoinButton,
  getCircleBackgroundStyle,
} satisfies SignupCircles;
