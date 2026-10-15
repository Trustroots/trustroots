import log from './../../../../config/lib/logger.mjs';
export type ValidationFailure = {
  message?: string;
  status?: number;
  errors?: Record<string, { message?: string }>;
};
export interface ErrorBody {
  message: string;
  error?: unknown;
}
export interface MessageResponse<Result = unknown> {
  status(code: number): { send(body: ErrorBody): Result };
}
interface NegotiatedErrorResponse {
  status(code: number): {
    format(handlers: Record<string, () => void>): unknown;
  };
  render(template: string): unknown;
  json(body: ErrorBody): unknown;
  send(body: string): unknown;
}

// Default error message when unsure how to respond
const defaultErrorMessage =
  'Snap! Something went wrong. If this keeps happening, please contact us.';

/**
 * Get the error by key
 * This is to keep error messages consistent.
 *
 * @param key String Message key
 * @return String Error message
 */
export function getErrorMessageByKey(key?: string): string {
  const errorMessages: Record<string, string> = {
    'not-found': 'Not found.',
    forbidden: 'Forbidden.',
    'invalid-id': 'Cannot interpret id.',
    'unprocessable-entity': 'Unprocessable Entity.',
    // Status 422, @link http://www.restpatterns.org/HTTP_Status_Codes/422_-_Unprocessable_Entity
    'unsupported-media-type': 'Unsupported Media Type.',
    // Status 415
    'bad-request': 'Bad request.',
    // Status 400
    conflict: 'Conflict.',
    // Status 409
    suspended: 'Your account has been suspended.',
    default: defaultErrorMessage,
  };
  return key && errorMessages[key] ? errorMessages[key] : defaultErrorMessage;
}

/**
 * Get the error message from error object
 * @param err Error
 * @return String Error message
 */
export function getErrorMessage(err: ValidationFailure): string {
  let message: string | false = false;
  for (const errName in err.errors) {
    if (err.errors[errName].message) message = err.errors[errName].message;
  }
  return message || defaultErrorMessage;
}

/**
 * Send a 400 response for a value that is not a valid ObjectId
 * @param res Object Express response
 * @return Object Express response
 */
export function sendInvalidId<Result>(res: MessageResponse<Result>): Result {
  return res.status(400).send({
    message: getErrorMessageByKey('invalid-id'),
  });
}

/**
 * Send a 400 response, deriving the message from a Mongoose error when given
 * @param res Object Express response
 * @param err Error Mongoose error object, optional
 * @return Object Express response
 */
export function sendBadRequest<Result>(
  res: MessageResponse<Result>,
  err?: unknown,
): Result {
  return res.status(400).send({
    message: err
      ? getErrorMessage(err as ValidationFailure)
      : getErrorMessageByKey('bad-request'),
  });
}

/**
 * Send a 404 "not found" response
 * @param res Object Express response
 * @return Object Express response
 */
export function sendNotFound<Result>(res: MessageResponse<Result>): Result {
  return res.status(404).send({
    message: getErrorMessageByKey('not-found'),
  });
}

/**
 * Send a 403 "forbidden" response
 * @param res Object Express response
 * @return Object Express response
 */
export function sendForbidden<Result>(res: MessageResponse<Result>): Result {
  return res.status(403).send({
    message: getErrorMessageByKey('forbidden'),
  });
}

/**
 * Error responses middleware
 */
export function errorResponse(
  rawError: unknown,
  req: unknown,
  res: NegotiatedErrorResponse,
  next: () => unknown,
) {
  // If the error object doesn't exists
  if (!rawError) return next();
  const err = rawError as ValidationFailure;

  // Log errors
  log('error', 'API error response', err);

  // Construct error response
  const errorResponse: ErrorBody = {
    message: err.message || defaultErrorMessage,
  };

  // In development mode, pass the error with the response
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error = err;
  }

  // Do content negotiation and return a message
  return res.status(err.status || 500).format({
    'text/html'() {
      res.render('500.server.view.html');
    },
    'application/json'() {
      res.json(errorResponse);
    },
    default() {
      res.send(errorResponse.message);
    },
  });
}
const defaultInterop = {
  getErrorMessageByKey,
  getErrorMessage,
  errorResponse,
  sendInvalidId,
  sendBadRequest,
  sendNotFound,
  sendForbidden,
};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
