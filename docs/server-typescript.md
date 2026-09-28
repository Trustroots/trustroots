# Server TypeScript

Server TypeScript uses `tsconfig.server.json` and `npm run typecheck:server`.
The aggregate `npm run typecheck` command includes this check in CI.

Node 24 executes the opted-in `.cts` modules by stripping erasable TypeScript
syntax. Keep runtime code to erasable types: avoid enums, parameter properties,
runtime namespaces, path aliases and JSX. Node does not read `tsconfig.server.json`
or type-check at runtime. Existing `.js` adapters retain the paths used by
CommonJS callers.

The authentication service and build-metadata helper are the first runtime
modules. Their tests exercise the adapters and the typed implementations.
The NYC server coverage report includes both the CommonJS adapters and the
`.cts` sources in the existing 100% coverage gate. It also includes opted-in
`.cts` files that tests do not load, so untested code lowers coverage.
The server test runner transpiles `.cts` through the existing TypeScript
dependency with inline source maps because NYC's require hook cannot pass raw
TypeScript to Node's native type stripper. Application and e2e runtimes use
Node's native path.

Server and worker development watches and the server test watch include `.cts`
files in both `config` and server modules. The server checker has its own
configuration, without browser libraries or client path aliases.

Keep this trial limited to these two modules until its value is assessed
against checked JavaScript and stronger tests. Further migration needs evidence
of useful errors caught by the types that outweigh the adapters and test hook.

## Initial comparison: 28 September 2026

A small diagnostic comparison used TypeScript 5.3.3 on Node 24.21.0. The
authentication implementation was checked under the strict server settings,
then transpiled to JavaScript and checked again with equivalent JSDoc parameter
and return types (`allowJs` and `checkJs`). Both unmodified versions passed.
Each artificial fault was tested separately in memory:

The [recorded diagnostics](experiments/server-types-2026-09-28.json) include
the clean controls, the three faults and the checked caller probe.

| Fault                                                            | `.cts` | Checked JavaScript |
| ---------------------------------------------------------------- | ------ | ------------------ |
| Return a Buffer where the email-token function promises a string | TS2322 | TS2322             |
| Pass a string instead of the email-token salt Buffer             | TS2345 | TS2345             |
| Return a number from the reserved-username predicate             | TS2322 | TS2322             |

The JSDoc comparison described the same email-holder shape, Buffer parameter,
username callback and boolean/string return types. No production files were
changed by these probes. These cases show useful static checks, but no
advantage specific to `.cts` over checked JavaScript for the sampled mistakes.

A separate `@ts-check` JavaScript caller passed a string salt through the
existing CommonJS authentication adapter without a diagnostic. The current
trial therefore does not yet establish a checked contract for existing callers;
its source checks must not be presented as end-to-end type safety.

Recommendation: retain the two-module trial, keep its tests and coverage, and
prefer assessing checked JavaScript before another runtime migration. Compare
a real refactor or consumer contract next; these three synthetic examples do
not settle the wider trade-off or replace runtime validation.
