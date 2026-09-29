export interface ClientApiError {
  status?: number;
  message?: string;
  data: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readApiError(error: unknown): ClientApiError {
  if (!isRecord(error)) {
    return { data: {} };
  }

  const response = isRecord(error.response) ? error.response : {};
  const data = isRecord(response.data) ? response.data : {};

  return {
    status:
      typeof response.status === 'number'
        ? response.status
        : typeof error.status === 'number'
        ? error.status
        : undefined,
    message: typeof data.message === 'string' ? data.message : undefined,
    data,
  };
}
