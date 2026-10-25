/**
 * Google Apps Script Web App-тай харилцах нимгэн клиент.
 *
 * - POST нь `text/plain` ашиглана: ингэснээр браузер CORS preflight (OPTIONS) явуулахгүй,
 *   Apps Script Web App-д ямар ч тохиргоогүйгээр ажиллана.
 * - Сүлжээний алдаа (GasNetworkError) болон серверийн логик алдаа (GasApiError)-г ялгана.
 * - Сүлжээ эсвэл серверийн түгжээний (lock timeout / BUSY) алдаа гарвал
 *   exponential backoff-оор 3 удаа автоматаар дахин оролдоно.
 * - Idempotency: бичих хүсэлт бүрд клиентийн үүсгэсэн `requestId` дамжуулж,
 *   давхар дарахаас болон дахин илгээх үед мөр давхардахаас сэргийлнэ.
 */

export class GasNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GasNetworkError';
  }
}

export class GasApiError extends Error {
  code?: string;
  retryable: boolean;
  constructor(message: string, code?: string, retryable = false) {
    super(message);
    this.name = 'GasApiError';
    this.code = code;
    this.retryable = retryable;
  }
}

const DEFAULT_TIMEOUT_MS = 45000;
const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 120;

export function isValidGasUrl(url: string): boolean {
  return /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[^/]+\/exec\/?$/.test(url.trim());
}

export function generateRequestId(): string {
  return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function parseResponse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Apps Script нэвтрэх/зөвшөөрлийн HTML хуудас буцаасан гэсэн үг
    throw new GasNetworkError(
      'Apps Script JSON биш хариу буцаалаа. Deploy хийхдээ "Execute as: Me", "Who has access: Anyone" сонгосон эсэх, шинэ хувилбар deploy хийсэн эсэхээ шалгана уу.'
    );
  }
}

async function requestOnce(url: string, init: RequestInit, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
    if (!res.ok) {
      throw new GasNetworkError(`Сервер HTTP ${res.status} буцаалаа.`);
    }
    return await parseResponse(res);
  } catch (err) {
    if (err instanceof GasNetworkError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new GasNetworkError('Серверээс хариу ирсэнгүй (хугацаа хэтэрлээ). Сүлжээгээ шалгаад дахин оролдоно уу.');
    }
    throw new GasNetworkError(
      err instanceof Error
        ? `Сүлжээний алдаа: ${err.message}`
        : `Сүлжээний алдаа: ${String(err)}`
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Exponential backoff-оор 3 удаа дахин оролдох wrapper.
 * Ижил `requestId` дамжуулагддаг тул сервер талд idempotency бүрэн хангагдана.
 */
async function executeWithRetry<T>(
  operation: () => Promise<any>,
  maxAttempts = MAX_ATTEMPTS
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await operation();
      if (!data || data.success !== true) {
        const apiErr = new GasApiError(
          data?.error || 'Серверээс алдаа буцаалаа.',
          data?.code,
          !!data?.retryable || data?.code === 'BUSY'
        );
        if (apiErr.retryable && attempt < maxAttempts) {
          lastError = apiErr;
          await sleep(BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1));
          continue;
        }
        throw apiErr;
      }
      return data as T;
    } catch (err) {
      lastError = err;
      const isRetryable =
        err instanceof GasNetworkError ||
        (err instanceof GasApiError && (err.retryable || err.code === 'BUSY'));
      if (isRetryable && attempt < maxAttempts) {
        await sleep(BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/** POST action — `success:false` үед GasApiError шиднэ. 3 удаа exponential backoff retry хийнэ. */
export async function gasPost<T = any>(
  url: string,
  body: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const payload = body.requestId ? body : { ...body, requestId: generateRequestId() };
  return executeWithRetry<T>(() =>
    requestOnce(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      },
      timeoutMs
    )
  );
}

export async function gasGet<T = any>(
  url: string,
  params: Record<string, string>,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const fullUrl = `${url}${url.includes('?') ? '&' : '?'}${qs}`;
  return executeWithRetry<T>(() => requestOnce(fullUrl, { method: 'GET' }, timeoutMs));
}
