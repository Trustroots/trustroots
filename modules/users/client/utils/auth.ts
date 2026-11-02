const confirmationTokenPattern = /^.{40}(?:[0-9a-f]{2})+$/i;
const localReturnToPattern = /^\/(?:$|[^/\\])/;

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

export function getEmailFromToken(token = ''): string | null {
  if (typeof token !== 'string' || !confirmationTokenPattern.test(token)) {
    return null;
  }

  let email = '';

  for (let index = 40; index < token.length; index += 2) {
    email += String.fromCharCode(parseInt(token.substr(index, 2), 16));
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

// Only paths on this site may be return destinations. Resolving against a
// fixed base keeps the origin check independent of the page's own origin.
const returnToBase = 'https://trustroots.invalid';

export function getSafeReturnTo(
  returnTo: string | null | undefined,
): string | null {
  if (typeof returnTo !== 'string' || !localReturnToPattern.test(returnTo)) {
    return null;
  }

  const destination = new URL(returnTo, returnToBase);

  if (destination.origin !== returnToBase) {
    return null;
  }

  return `${destination.pathname}${destination.search}${destination.hash}`;
}

// The page reloads after sign-in: the signin response leaves out the roles
// the server adds to the bootstrapped user, which role-guarded routes need.
export function redirectAfterSignin(
  navigate: (options: { href: string; reloadDocument: true }) => unknown,
  continueSignin: boolean,
  returnTo?: string | null,
): void {
  void navigate({
    href: (continueSignin && getSafeReturnTo(returnTo)) || '/search',
    reloadDocument: true,
  });
}
