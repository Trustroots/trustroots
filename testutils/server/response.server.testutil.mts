/** The response surface exercised by asynchronous controller tests. */
export interface DeferredResponse {
  statusCode: number;
  body: unknown;
  redirectUrl: string | null;
  status(code: number): DeferredResponse;
  send(body: unknown): DeferredResponse;
  json(body: unknown): DeferredResponse;
  redirect(url: string): DeferredResponse;
  waitForResponse(): Promise<DeferredResponse>;
}

/** Resolve when a controller sends a response or redirects. */
export function deferredResponse(): DeferredResponse {
  let resolveResponse: (response: DeferredResponse) => void = () => {
    throw new Error('Response completion has not been initialised');
  };
  const promise = new Promise<DeferredResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: DeferredResponse = {
    statusCode: 200,
    body: null,
    redirectUrl: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      resolveResponse(res);
      return res;
    },
    json(body) {
      return res.send(body);
    },
    redirect(url) {
      res.redirectUrl = url;
      resolveResponse(res);
      return res;
    },
    waitForResponse: () => promise,
  };
  return res;
}
