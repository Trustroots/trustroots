export type AdminIdentityLabel =
  'Username identifier' | 'Email identifier' | 'Temporary email identifier';

export type AdminIdentity = {
  label: AdminIdentityLabel;
  value: string;
};

type AdminIdentitySource = {
  username: string;
  email: string;
  emailTemporary: string;
};

function normaliseAdminIdentity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function emailLocalPart(value: string): string {
  return value.split('@')[0];
}

export function getAdminIdentityIdentifiers(
  user: AdminIdentitySource,
): AdminIdentity[] {
  return [
    {
      label: 'Username identifier',
      value: normaliseAdminIdentity(user.username),
    },
    {
      label: 'Email identifier',
      value: normaliseAdminIdentity(emailLocalPart(user.email)),
    },
    {
      label: 'Temporary email identifier',
      value: normaliseAdminIdentity(emailLocalPart(user.emailTemporary)),
    },
  ];
}

export function getUniqueAdminIdentityIdentifiers(
  user: AdminIdentitySource,
  minimumLength: number,
): AdminIdentity[] {
  return getAdminIdentityIdentifiers(user).filter(
    ({ value }, index, identifiers) =>
      value.length >= minimumLength &&
      identifiers.findIndex(identifier => identifier.value === value) === index,
  );
}
