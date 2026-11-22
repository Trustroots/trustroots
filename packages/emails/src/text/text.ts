/** Text that is already escaped and must not be escaped again. */
class Escaped {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
}

const escapes: Record<string, string> = {
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;',
  '<': '&lt;',
  '>': '&gt;',
  '\\': '&#92;',
};

function escapeValue(value: unknown): string {
  if (value instanceof Escaped) return value.value;
  return String(value ?? '').replace(
    /[&"'<>\\]/g,
    character => escapes[character],
  );
}

/**
 * Plain text template: interpolated values are HTML-escaped, as the text part
 * is later run through `textService.plainText`, which decodes entities.
 */
export function text(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Escaped {
  return new Escaped(
    strings.reduce(
      (out, string, index) => out + escapeValue(values[index - 1]) + string,
    ),
  );
}
