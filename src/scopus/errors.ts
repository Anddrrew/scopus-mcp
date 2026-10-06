import { validateSchema } from '../schemas/schema';
import { errorBodySchema } from './error-schema';

export class ScopusError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ScopusError';
  }
}

export async function apiError(
  status: number,
  body: unknown,
  headers: Record<string, string>,
  secrets: string[],
): Promise<ScopusError> {
  const parsed = await validateSchema(errorBodySchema, body);
  const details = parsed.issues ? undefined : parsed.value;
  const service = details?.['service-error']?.status;
  const gateway = details?.['error-response'];
  const messages: Record<number, string> = {
    400: 'Invalid Scopus query or parameters.',
    401: 'Scopus authentication failed. Check ELSEVIER_API_KEY.',
    403: 'Scopus access denied. Check your subscription, institutional network or token.',
    429: 'Scopus quota or request rate exceeded. Check the response metadata before retrying.',
  };
  const redact = (value: string): string => {
    for (const secret of secrets.filter(Boolean)) {
      value = value
        .replaceAll(secret, '[REDACTED]')
        .replaceAll(encodeURIComponent(secret), '[REDACTED]');
    }
    return value.slice(0, 1000);
  };
  return new ScopusError(
    redact(service?.statusCode ?? gateway?.errorCode ?? `HTTP_${status}`),
    redact(
      service?.statusText ??
        gateway?.errorMessage ??
        messages[status] ??
        `Scopus request failed (HTTP ${status}).`,
    ),
    status,
    headers,
  );
}
