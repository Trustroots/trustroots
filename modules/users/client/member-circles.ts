import type { CircleSource } from '@trustroots/analytics/client';
import type { ButtonStyleProps } from '@trustroots/ui/Button';
import type { ComponentType, CSSProperties } from 'react';
import type { ProfileTribe } from '../shared/profile';
import type { UserProfile } from './types';

export interface CircleMembershipUpdate {
  tribe?: ProfileTribe;
  user?: UserProfile;
}

export interface ProfileCircles {
  read: (options: { limit: number }) => Promise<ProfileTribe[]>;
  getCircleBackgroundStyle: (
    circle: ProfileTribe,
    dimensions: string,
  ) => CSSProperties;
  JoinButton: ComponentType<{
    look: ButtonStyleProps;
    tribe: ProfileTribe;
    user?: UserProfile;
    onUpdated?: (data: CircleMembershipUpdate) => void;
    source: CircleSource;
  }>;
}

export interface SignupCircles extends ProfileCircles {
  get: (slug: string) => Promise<ProfileTribe>;
  join: (id: string) => Promise<CircleMembershipUpdate>;
}
