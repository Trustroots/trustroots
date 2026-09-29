import { readApiError } from '@/modules/users/client/utils/api-error';

describe('readApiError', () => {
  it('returns an empty error for non-object rejection values', () => {
    expect(readApiError('failed')).toEqual({ data: {} });
    expect(readApiError(null)).toEqual({ data: {} });
  });

  it('reads a top-level status when the response has no numeric status', () => {
    expect(readApiError({ status: 404 })).toEqual({
      status: 404,
      message: undefined,
      data: {},
    });
  });

  it('ignores non-object response payloads and non-string messages', () => {
    expect(readApiError({ response: { status: '404', data: 'bad' } })).toEqual({
      status: undefined,
      message: undefined,
      data: {},
    });
  });
});
