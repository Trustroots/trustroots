import { basename } from 'node:path';
import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import packageJson from '../../package.json' with { type: 'json' };

type SeedCommand = {
  description: string;
  positionals: string[];
  flags?: Record<string, string>;
  example: string;
  acceptsUserNames?: boolean;
};

export function parseSeedArgs(
  args: string[],
  { description, positionals, flags, example, acceptsUserNames }: SeedCommand,
) {
  const descriptions = {
    help: 'Show help',
    version: 'Show version number',
    debug: 'Enable extra database output',
    ...flags,
    ...(acceptsUserNames ? { userNames: 'List of admin usernames' } : {}),
  };
  const options: ParseArgsOptionsConfig = {};
  for (const name of Object.keys(descriptions)) {
    options[name] = { type: name === 'userNames' ? 'string' : 'boolean' };
  }

  const script = basename(process.argv[1] ?? 'seed');
  const usage = `Usage: ${script} ${positionals.map(name => `<${name}>`).join(' ')}`;
  const { values, tokens } = parseArgs({
    args: args.map(arg =>
      arg
        .replace(/^--user-names(?==|$)/, '--userNames')
        .replace(/^--(no-)?reCreate(?==|$)/, '--$1re-create')
        .replace(/^--([^=]+)=(true|false)$/, (option, name, value) =>
          options[name]?.type === 'boolean'
            ? `--${value === 'false' ? 'no-' : ''}${name}`
            : option,
        ),
    ),
    options,
    allowPositionals: true,
    allowNegative: true,
    tokens: true,
  });
  if (values.help) {
    console.log(
      [
        usage,
        description,
        '',
        'Options:',
        ...Object.entries(descriptions).map(
          ([name, text]) => `  --${name}  ${text}`,
        ),
        '',
        `Example: node ${script} ${example}`,
      ].join('\n'),
    );
    process.exit(0);
  }
  if (values.version) {
    console.log(packageJson.version);
    process.exit(0);
  }

  const operands: string[] = [];
  const userNames: string[] = [];
  let readingUserNames = false;
  // parseArgs consumes one value for the option. Keep the existing variadic
  // --userNames syntax by collecting any following operands up to the next flag.
  for (const token of tokens) {
    if (token.kind === 'positional') {
      (readingUserNames ? userNames : operands).push(token.value);
    } else {
      readingUserNames = token.kind === 'option' && token.name === 'userNames';
      if (
        token.kind === 'option' &&
        readingUserNames &&
        token.value !== undefined
      ) {
        userNames.push(token.value);
      }
    }
  }
  if (operands.length !== positionals.length) throw new Error(usage);

  return { operands, values, userNames };
}

export function readSeedNumber(
  input: string | undefined,
  message: string,
  min: number,
  max = Infinity,
) {
  const value = Number(input);
  if (!input?.trim() || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(message);
  }
  return value;
}
