import {
  broadcastClientEvent,
  navigate,
} from '@/modules/core/client/services/client-runtime';
import { refine, regex, string } from 'zod/mini';

const confirmationTokenSchema = string().check(
  regex(/^.{40}(?:[0-9a-f]{2})+$/i),
);
const localReturnToSchema = string().check(
  regex(/^\/(?:$|[^/\\])/),
  refine(
    value =>
      new URL(value, window.location.origin).origin === window.location.origin,
  ),
);

interface UsernameValidationInput {
  value?: string;
  isDirty?: boolean;
  isValid?: boolean;
  errors?: Partial<
    Record<
      'required' | 'maxlength' | 'minlength' | 'pattern' | 'username',
      boolean
    >
  >;
  usernameMinlength?: number;
  usernameMaxlength?: number;
  patternMessage?: string;
  usernameMessage?: string;
}

interface AuthenticatedUser {
  _id: string;
  username: string;
  roles?: string[];
}

declare global {
  interface Window {
    user?: AuthenticatedUser;
  }
}

export function getEmailFromToken(token = ''): string | null {
  const parsedToken = confirmationTokenSchema.safeParse(token);

  if (!parsedToken.success) {
    return null;
  }

  let email = '';

  for (let index = 40; index < parsedToken.data.length; index += 2) {
    email += String.fromCharCode(
      parseInt(parsedToken.data.substr(index, 2), 16),
    );
  }

  return email;
}

export function getUsernameValidationError({
  value = '',
  isDirty = false,
  isValid = true,
  errors = {},
  usernameMinlength = 3,
  usernameMaxlength = 34,
  patternMessage = 'Invalid username.',
  usernameMessage = 'This username is already in use.',
}: UsernameValidationInput): string {
  if (!isDirty || isValid) {
    return '';
  }

  if (errors.required || value === '') {
    return 'Username is required.';
  }

  if (errors.maxlength) {
    return `Too long, maximum length is ${usernameMaxlength} characters.`;
  }

  if (errors.minlength) {
    return `Too short, minimum length is ${usernameMinlength} characters.`;
  }

  if (errors.pattern) {
    return patternMessage;
  }

  if (errors.username) {
    return usernameMessage;
  }

  return 'Invalid username.';
}

export function applyAuthenticatedUser(
  user: AuthenticatedUser,
  setUser: (user: AuthenticatedUser) => void,
): void {
  setUser(user);
  window.user = user;
  broadcastClientEvent('userUpdated');
}

export function getSafeReturnTo(
  returnTo: string | null | undefined,
): string | null {
  const parsedReturnTo = localReturnToSchema.safeParse(returnTo);

  if (!parsedReturnTo.success) {
    return null;
  }

  const destination = new URL(parsedReturnTo.data, window.location.origin);

  return `${destination.pathname}${destination.search}${destination.hash}`;
}

export function redirectAfterSignin(
  continueSignin: boolean,
  returnTo?: string | null,
): void {
  navigate(
    continueSignin ? getSafeReturnTo(returnTo) || 'search.map' : 'search.map',
    undefined,
    { reload: true },
  );
}
