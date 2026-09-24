type EmailHolder = { email: string; emailTemporary?: string };

function generateEmailToken(user: EmailHolder, saltBuffer: Buffer): string {
  const email = user.emailTemporary || user.email;
  const buf = Buffer.concat([saltBuffer, Buffer.from(email)]);
  return buf.toString('hex');
}

function validateUsername(
  value: unknown,
  isUsernameReserved: (username: string) => boolean,
): boolean | string {
  const username = String(value).toLowerCase();
  const usernameRegex = /^(?=.*[0-9a-z])[0-9a-z.\-_]{3,34}$/;
  const dotsRegex = /^[^.](?!.*(\.)\1).*[^.]$/;

  return (
    username &&
    usernameRegex.test(username) &&
    dotsRegex.test(username) &&
    !isUsernameReserved(username)
  );
}

function isUsernameReserved(
  username: string,
  illegalStrings: readonly string[],
): boolean {
  return illegalStrings.indexOf(username.toLowerCase()) !== -1;
}

module.exports = {
  generateEmailToken,
  validateUsername,
  isUsernameReserved,
};
