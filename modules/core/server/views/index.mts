import { createElement as h, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import jsonForScript from '../services/json-for-script.server.service.mts';
import { Head, type PageLocals } from './head.mts';

/** The per-request head and bootstrap data added to the Start shell. */
export default function index(
  locals: PageLocals & {
    appSettings: unknown;
    env: string;
    isNativeMobileApp: boolean;
    user: unknown;
  },
): string {
  const { title, appSettings, env, isNativeMobileApp, user } = locals;
  return renderToStaticMarkup(
    h(
      Fragment,
      null,
      h(Head, locals),
      h('script', {
        nonce: locals.nonce,
        dangerouslySetInnerHTML: {
          __html: `var title = ${jsonForScript(title)}, settings = ${jsonForScript(appSettings)}, env = ${jsonForScript(env)}, isNativeMobileApp = ${isNativeMobileApp}, user = ${jsonForScript(user)};`,
        },
      }),
    ),
  );
}
