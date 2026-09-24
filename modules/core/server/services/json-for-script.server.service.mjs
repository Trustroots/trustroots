/** Serialise bootstrap data without introducing HTML delimiters. */
export function jsonForScript(value) {
  return JSON.stringify(value === undefined ? null : value).replace(
    /[<>&\u2028\u2029]/g,
    character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

export default jsonForScript;
