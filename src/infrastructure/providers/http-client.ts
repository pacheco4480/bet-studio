import {
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderUnavailableError,
  ProviderValidationError,
} from '../../shared/errors.js';

export type HttpResponse<T> = {
  data: T;
  headers: Headers;
};

export type JsonHttpClient = {
  get<T>(
    path: string,
    query?: Record<string, string | number | null | undefined>,
  ): Promise<HttpResponse<T>>;
};

export type JsonHttpClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  fetchFn?: typeof fetch;
};

export class FetchJsonHttpClient implements JsonHttpClient {
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: JsonHttpClientOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async get<T>(
    path: string,
    query: Record<string, string | number | null | undefined> = {},
  ): Promise<HttpResponse<T>> {
    return this.requestWithRetry<T>(path, query, 0);
  }

  private async requestWithRetry<T>(
    path: string,
    query: Record<string, string | number | null | undefined>,
    attempt: number,
  ): Promise<HttpResponse<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs,
    );

    try {
      const response = await this.fetchFn(this.buildUrl(path, query), {
        headers: { Authorization: `Bearer ${this.options.apiKey}` },
        signal: controller.signal,
      });

      if (response.status === 401)
        throw new ProviderAuthenticationError('GOAL API authentication failed');
      if (response.status === 429)
        throw new ProviderRateLimitError('GOAL API rate limit exceeded');
      if (response.status >= 500 && attempt === 0)
        return this.requestWithRetry(path, query, 1);
      if (!response.ok)
        throw new ProviderValidationError(
          `GOAL API request failed with status ${response.status}`,
        );

      return { data: (await response.json()) as T, headers: response.headers };
    } catch (error) {
      if (
        error instanceof ProviderAuthenticationError ||
        error instanceof ProviderRateLimitError ||
        error instanceof ProviderValidationError
      ) {
        throw error;
      }
      if (attempt === 0) return this.requestWithRetry(path, query, 1);
      throw new ProviderUnavailableError('GOAL API request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUrl(
    path: string,
    query: Record<string, string | number | null | undefined>,
  ): URL {
    const url = new URL(
      `${this.options.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
    );
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '')
        url.searchParams.set(key, String(value));
    }
    return url;
  }
}
